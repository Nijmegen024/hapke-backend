import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';

import type { Vendor, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterVendorDto } from './dto/register-vendor.dto';
import { LoginVendorDto } from './dto/login-vendor.dto';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';
import { UpdateRestaurantSettingsDto } from './dto/restaurant-settings.dto';
import {
  CreateMenuCategoryDto,
  UpdateMenuCategoryDto,
} from './dto/menu-category.dto';
import {
  CreateMenuItemDto,
  UpdateMenuItemDto,
} from './dto/menu-item.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { geocodeAddress } from '../utils/geocoding';

type VendorTokenPayload = {
  sub: string;
  role: Role;
  email: string;
};

type SafeVendor = Omit<Vendor, 'passwordHash'>;
type CategoryWithItems = Prisma.VendorMenuCategoryGetPayload<{
  include: { items: true };
}>;
type MenuItemEntity = Prisma.VendorMenuItemGetPayload<{}>;

@Injectable()
export class VendorService {
  private readonly logger = new Logger(VendorService.name);
  private readonly cookieName = 'vendor_token';
  private readonly cookieOptions = this.createCookieOptions();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterVendorDto) {
    const email = dto.email.toLowerCase().trim();
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Bedrijfsnaam is verplicht');
    }

    const existing = await this.prisma.vendor.findUnique({
      where: { email },
    });
    if (existing) {
      throw new BadRequestException('E-mailadres is al geregistreerd');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const street = this.normalizeString(dto.street);
    const postalCode = this.normalizeString(dto.postalCode);
    const city = this.normalizeString(dto.city);
    const location = await geocodeAddress({ street, postalCode, city });

    const vendor = await this.prisma.vendor.create({
      data: {
        email,
        passwordHash,
        name,
        contactName: dto.contactName?.trim() || null,
        phone: dto.phone?.trim() || null,
        street,
        postalCode,
        city,
        description: dto.description?.trim() || null,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        isActive: false,
      },
    });

    return vendor;
  }

  async login(email: string, password: string) {
    const emailNorm = (email ?? '').toLowerCase().trim();
    const vendor = await this.prisma.vendor.findUnique({
      where: { email: emailNorm },
    });

    if (!vendor) {
      this.logger.warn(`LOGIN vendor ${emailNorm} not found`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordOk = await bcrypt.compare(
      (password ?? '').trim(),
      vendor.passwordHash ?? '',
    );

    this.logger.log(`LOGIN vendor ${emailNorm} found? ${!!vendor}`);
    this.logger.log(`LOGIN password ok? ${passwordOk}`);

    let finalOk = passwordOk;

    // Fallback: als er per ongeluk een plain password is opgeslagen, probeer een directe match en upgrade dan naar hash
    if (!finalOk && vendor.passwordHash && vendor.passwordHash === password) {
      this.logger.warn('LOGIN found plain password; upgrading to hash');
      finalOk = true;
      try {
        const upgradedHash = await bcrypt.hash(password.trim(), 12);
        await this.prisma.vendor.update({
          where: { id: vendor.id },
          data: { passwordHash: upgradedHash },
        });
      } catch (e) {
        this.logger.warn(`Could not upgrade plain password for ${vendor.email}: ${e}`);
      }
    }

    if (!finalOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: VendorTokenPayload = {
      sub: vendor.id,
      role: 'VENDOR',
      email: vendor.email,
    };
    const accessToken = this.jwt.sign(payload);
    this.logger.log(
      `LOGIN payload: ${JSON.stringify(payload)}, token(first20): ${accessToken.slice(0, 20)}`,
    );

    return {
      accessToken,
      vendor: {
        id: vendor.id,
        email: vendor.email,
        name: vendor.name,
      },
    };
  }

  async validateCredentials(dto: LoginVendorDto) {
    const email = dto.email.toLowerCase().trim();
    const password = dto.password.trim();

    const vendor = await this.prisma.vendor.findUnique({
      where: { email },
    });
    if (!vendor) {
      throw new UnauthorizedException('Ongeldige inloggegevens');
    }

    const digest = vendor.passwordHash ?? '';
    const isHashed = digest.startsWith('$2');
    const isMatch = isHashed
      ? await bcrypt.compare(password, digest)
      : digest === password;

    if (!isMatch) {
      throw new UnauthorizedException('Ongeldige inloggegevens');
    }

    if (!isHashed) {
      try {
        const upgradedHash = await bcrypt.hash(password, 12);
        await this.prisma.vendor.update({
          where: { id: vendor.id },
          data: { passwordHash: upgradedHash },
        });
        vendor.passwordHash = upgradedHash;
      } catch (error) {
        this.logger.warn(
          `Kon wachtwoord voor vendor ${vendor.email} niet upgraden: ${error}`,
        );
      }
    }

    return vendor;
  }

  async signToken(vendor: Vendor) {
    const payload: VendorTokenPayload = {
      sub: vendor.id,
      email: vendor.email,
      role: vendor.role,
    };
    return this.jwt.signAsync(payload);
  }

  async verifyToken(token: string): Promise<VendorTokenPayload> {
    try {
      this.logger.log(
        `VERIFY JWT secret defined? ${!!process.env.JWT_SECRET}`,
      );
      const payload = await this.jwt.verifyAsync<VendorTokenPayload>(token);
      this.logger.log('VERIFY payload', payload);
      return payload;
    } catch (error) {
      this.logger.warn(`Vendor token ongeldig: ${error}`);
      throw new UnauthorizedException('Ongeldige sessie');
    }
  }

  async authenticateToken(rawToken: string | null) {
    if (!rawToken) {
      throw new UnauthorizedException('Geen vendor sessie gevonden');
    }
    const payload = await this.verifyToken(rawToken);
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: payload.sub },
    });
    if (!vendor) {
      throw new UnauthorizedException('Vendor niet gevonden');
    }
    return vendor;
  }

  async authenticateRequest(req: Request) {
    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException('Geen vendor sessie gevonden');
    }
    const payload = await this.verifyToken(token);
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: payload.sub },
    });
    if (!vendor) {
      throw new UnauthorizedException('Vendor niet gevonden');
    }
    return vendor;
  }

  applyAuthCookie(res: Response, token: string) {
    res.cookie(this.cookieName, token, this.cookieOptions);
  }

  clearAuthCookie(res: Response) {
    res.cookie(this.cookieName, '', { ...this.cookieOptions, maxAge: 0 });
  }

  async getVendorDashboard(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });
    if (!vendor) {
      throw new UnauthorizedException('Vendor niet gevonden');
    }
    const categories = await this.prisma.vendorMenuCategory.findMany({
      where: { vendorId },
      orderBy: { position: 'asc' },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    const uncategorized = await this.prisma.vendorMenuItem.findMany({
      where: { vendorId, categoryId: null },
      orderBy: { position: 'asc' },
    });
    return {
      vendor: this.mapVendorProfile(vendor),
      menu: {
        categories: categories.map((category) =>
          this.mapCategoryWithItems(category),
        ),
        uncategorized: uncategorized.map((item) => this.mapMenuItem(item)),
      },
    };
  }

  async updateVendorProfile(vendorId: string, dto: UpdateVendorProfileDto) {
    const street = this.normalizeString(dto.street);
    const postalCode = this.normalizeString(dto.postalCode);
    const city = this.normalizeString(dto.city);
    const shouldGeocode =
      dto.street !== undefined ||
      dto.postalCode !== undefined ||
      dto.city !== undefined;
    let location: { lat: number; lng: number } | null = null;
    if (shouldGeocode) {
      const existing = await this.prisma.vendor.findUnique({
        where: { id: vendorId },
      });
      const nextStreet = street ?? existing?.street ?? null;
      const nextPostalCode = postalCode ?? existing?.postalCode ?? null;
      const nextCity = city ?? existing?.city ?? null;
      location = await geocodeAddress({
        street: nextStreet,
        postalCode: nextPostalCode,
        city: nextCity,
      });
    }
    const vendor = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        name: this.normalizeString(dto.name) ?? undefined,
        contactName: this.normalizeString(dto.contactName),
        phone: this.normalizeString(dto.phone),
        street,
        postalCode,
        city,
        description: this.normalizeString(dto.description),
        heroImageUrl: this.normalizeString(dto.heroImageUrl),
        logoImageUrl: this.normalizeString(dto.logoImageUrl),
        minOrder:
          dto.minOrder === undefined ? undefined : Number(dto.minOrder),
        deliveryFee:
          dto.deliveryFee === undefined ? undefined : Number(dto.deliveryFee),
        etaDisplay: this.normalizeString(dto.etaDisplay),
        cuisine: this.normalizeString(dto.cuisine),
        category: this.normalizeString(dto.category),
        isActive: dto.isActive ?? undefined,
        isFeatured: dto.isFeatured ?? undefined,
        ...(location ? { lat: location.lat, lng: location.lng } : {}),
      },
    });
    return this.mapVendorProfile(vendor);
  }

  async getRestaurantSettings(vendorId: string) {
    let vendor = (await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    })) as any;
    if (!vendor) {
      throw new UnauthorizedException('Vendor niet gevonden');
    }
    if (
      (vendor.lat === null || vendor.lat === undefined) &&
      (vendor.lng === null || vendor.lng === undefined)
    ) {
      const location = await geocodeAddress({
        street: vendor.street,
        postalCode: vendor.postalCode,
        city: vendor.city,
      });
      if (location) {
        vendor = (await this.prisma.vendor.update({
          where: { id: vendorId },
          data: { lat: location.lat, lng: location.lng },
        })) as any;
      }
    }
    return {
      name: vendor.name,
      description: vendor.description,
      minOrderAmount: this.decimalToNumber(vendor.minOrder),
      heroImageUrl: this.normalizeString(vendor.heroImageUrl),
      logoImageUrl: this.normalizeString(vendor.logoImageUrl),
      street: vendor.street,
      postalCode: vendor.postalCode,
      city: vendor.city,
      lat: vendor.lat ?? null,
      lng: vendor.lng ?? null,
      deliveryRadiusKm: vendor.deliveryRadiusKm ?? 5,
    };
  }

  async updateRestaurantSettings(
    vendorId: string,
    dto: UpdateRestaurantSettingsDto,
  ) {
    const street = this.normalizeString(dto.street);
    const postalCode = this.normalizeString(dto.postalCode);
    const city = this.normalizeString(dto.city);
    const shouldGeocode =
      dto.street !== undefined ||
      dto.postalCode !== undefined ||
      dto.city !== undefined;
    let location: { lat: number; lng: number } | null = null;
    if (shouldGeocode) {
      const existing = await this.prisma.vendor.findUnique({
        where: { id: vendorId },
      });
      const nextStreet = street ?? existing?.street ?? null;
      const nextPostalCode = postalCode ?? existing?.postalCode ?? null;
      const nextCity = city ?? existing?.city ?? null;
      location = await geocodeAddress({
        street: nextStreet,
        postalCode: nextPostalCode,
        city: nextCity,
      });
    }

    const data: Prisma.VendorUpdateInput = {
      name: dto.name.trim(),
      description: this.normalizeString(dto.description),
      minOrder: Number(dto.minOrderAmount),
      heroImageUrl: this.normalizeString(dto.heroImageUrl),
      logoImageUrl: this.normalizeString(dto.logoImageUrl),
      deliveryRadiusKm:
        dto.deliveryRadiusKm !== undefined
          ? Number(dto.deliveryRadiusKm)
          : undefined,
    };
    if (dto.street !== undefined) data.street = street;
    if (dto.postalCode !== undefined) data.postalCode = postalCode;
    if (dto.city !== undefined) data.city = city;
    if (dto.lat !== undefined) data.lat = dto.lat;
    if (dto.lng !== undefined) data.lng = dto.lng;
    if (dto.lat === undefined && dto.lng === undefined && location) {
      data.lat = location.lat;
      data.lng = location.lng;
    }

    const vendor = (await this.prisma.vendor.update({
      where: { id: vendorId },
      data,
    })) as any;
    return {
      name: vendor.name,
      description: vendor.description,
      minOrderAmount: this.decimalToNumber(vendor.minOrder),
      heroImageUrl: this.normalizeString(vendor.heroImageUrl),
      logoImageUrl: this.normalizeString(vendor.logoImageUrl),
      street: vendor.street,
      postalCode: vendor.postalCode,
      city: vendor.city,
      lat: vendor.lat ?? null,
      lng: vendor.lng ?? null,
      deliveryRadiusKm: vendor.deliveryRadiusKm ?? 5,
    };
  }

  async createCategory(vendorId: string, dto: CreateMenuCategoryDto) {
    const category = await this.prisma.vendorMenuCategory.create({
      data: {
        vendorId,
        name: dto.name.trim(),
        description: this.normalizeString(dto.description),
        position: dto.position ?? 0,
      },
      include: { items: true },
    });
    return this.mapCategoryWithItems(category);
  }

  async updateCategory(
    vendorId: string,
    categoryId: string,
    dto: UpdateMenuCategoryDto,
  ) {
    const existing = await this.prisma.vendorMenuCategory.findFirst({
      where: { id: categoryId, vendorId },
      include: { items: true },
    });
    if (!existing) {
      throw new BadRequestException('Categorie niet gevonden');
    }
    const updated = await this.prisma.vendorMenuCategory.update({
      where: { id: categoryId },
      data: {
        name: dto.name?.trim(),
        description: this.normalizeString(dto.description),
        position: dto.position ?? existing.position,
      },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    return this.mapCategoryWithItems(updated);
  }

  async deleteCategory(vendorId: string, categoryId: string) {
    const existing = await this.prisma.vendorMenuCategory.findFirst({
      where: { id: categoryId, vendorId },
    });
    if (!existing) {
      throw new BadRequestException('Categorie niet gevonden');
    }
    await this.prisma.vendorMenuCategory.delete({ where: { id: categoryId } });
    return { ok: true };
  }

  async createMenuItem(vendorId: string, dto: CreateMenuItemDto) {
    if (dto.categoryId) {
      const category = await this.prisma.vendorMenuCategory.findFirst({
        where: { id: dto.categoryId, vendorId },
      });
      if (!category) {
        throw new BadRequestException('Categorie niet gevonden');
      }
    }
    const item = await this.prisma.vendorMenuItem.create({
      data: {
        vendorId,
        categoryId: dto.categoryId ?? null,
        name: dto.name.trim(),
        description: this.normalizeString(dto.description),
        price: dto.price,
        imageUrl: this.normalizeString(dto.imageUrl),
        isAvailable: dto.isAvailable ?? true,
        isHighlighted: dto.isHighlighted ?? false,
        position: dto.position ?? 0,
      },
    });
    return this.mapMenuItem(item);
  }

  async updateMenuItem(
    vendorId: string,
    itemId: string,
    dto: UpdateMenuItemDto,
  ) {
    const existing = await this.prisma.vendorMenuItem.findFirst({
      where: { id: itemId, vendorId },
    });
    if (!existing) {
      throw new BadRequestException('Menu item niet gevonden');
    }
    if (dto.categoryId) {
      const category = await this.prisma.vendorMenuCategory.findFirst({
        where: { id: dto.categoryId, vendorId },
      });
      if (!category) {
        throw new BadRequestException('Categorie niet gevonden');
      }
    }
    const item = await this.prisma.vendorMenuItem.update({
      where: { id: itemId },
      data: {
        name: dto.name?.trim(),
        description: dto.description
          ? this.normalizeString(dto.description)
          : undefined,
        price:
          dto.price === undefined ? undefined : Number(dto.price ?? 0),
        categoryId:
          dto.categoryId === undefined ? undefined : dto.categoryId ?? null,
        imageUrl:
          dto.imageUrl === undefined
            ? undefined
            : this.normalizeString(dto.imageUrl),
        isAvailable: dto.isAvailable ?? undefined,
        isHighlighted: dto.isHighlighted ?? undefined,
        position: dto.position ?? undefined,
      },
    });
    return this.mapMenuItem(item);
  }

  async deleteMenuItem(vendorId: string, itemId: string) {
    const existing = await this.prisma.vendorMenuItem.findFirst({
      where: { id: itemId, vendorId },
    });
    if (!existing) {
      throw new BadRequestException('Menu item niet gevonden');
    }
    await this.prisma.vendorMenuItem.delete({ where: { id: itemId } });
    return { ok: true };
  }

  async listVideos(vendorId: string) {
    await this.ensureVendor(vendorId);
    return this.prisma.video.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createVideo(vendorId: string, dto: CreateVideoDto) {
    await this.ensureVendor(vendorId);
    return this.prisma.video.create({
      data: {
        vendorId,
        title: dto.title,
        description: dto.description,
        videoUrl: dto.videoUrl,
        thumbUrl: dto.thumbUrl,
        isVisible: dto.isVisible ?? true,
      },
    });
  }

  async deleteVideo(vendorId: string, videoId: string) {
    await this.ensureVendor(vendorId);
    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video || video.vendorId !== vendorId) {
      throw new UnauthorizedException('Video niet gevonden of geen toegang');
    }
    await this.prisma.video.delete({ where: { id: videoId } });
    return { ok: true };
  }

  toSafeVendor(vendor: Vendor): SafeVendor {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = vendor;
    return rest;
  }

  private async ensureVendor(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      throw new UnauthorizedException('Vendor niet gevonden');
    }
    return vendor;
  }

  private mapVendorProfile(vendor: Vendor) {
    return {
      id: vendor.id,
      email: vendor.email,
      name: vendor.name,
      contactName: vendor.contactName,
      phone: vendor.phone,
      street: vendor.street,
      postalCode: vendor.postalCode,
      city: vendor.city,
      description: vendor.description,
      heroImageUrl: vendor.heroImageUrl,
      logoImageUrl: vendor.logoImageUrl,
      minOrder: this.decimalToNumber(vendor.minOrder),
      deliveryFee: this.decimalToNumber(vendor.deliveryFee),
      etaDisplay: vendor.etaDisplay,
      cuisine: vendor.cuisine,
      category: vendor.category,
      isActive: vendor.isActive,
      isFeatured: vendor.isFeatured,
      isVerified: vendor.isActive,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt,
    };
  }

  private mapCategoryWithItems(category: CategoryWithItems) {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      position: category.position,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      items: category.items.map((item) => this.mapMenuItem(item)),
    };
  }

  private mapMenuItem(item: MenuItemEntity) {
    return {
      id: item.id,
      vendorId: item.vendorId,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      price: this.decimalToNumber(item.price) ?? 0,
      imageUrl: item.imageUrl,
      isAvailable: item.isAvailable,
      isHighlighted: item.isHighlighted,
      position: item.position,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private normalizeString(value?: string | null) {
    if (typeof value !== 'string') {
      return value ?? null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private decimalToNumber(value?: Prisma.Decimal | number | null) {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      return value;
    }
    return value ? Number(value) : null;
  }

  private extractToken(req: Request): string | null {
    const auth = req.get('authorization');
    if (auth && auth.startsWith('Bearer ')) {
      return auth.slice(7).trim() || null;
    }
    const cookies = (req as Request & { cookies?: unknown }).cookies;
    if (cookies && typeof cookies === 'object') {
      const token = (cookies as Record<string, unknown>)[this.cookieName];
      if (typeof token === 'string' && token.trim().length > 0) {
        return token.trim();
      }
    }
    return null;
  }

  private createCookieOptions() {
    const cookieDomain = process.env.COOKIE_DOMAIN?.trim() || undefined;
    const cookieSecure =
      (process.env.COOKIE_SECURE ?? 'true').toLowerCase() !== 'false';
    const cookieSameSite = this.resolveSameSite(
      process.env.COOKIE_SAME_SITE,
    );
    return {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      domain: cookieDomain,
      path: '/vendor',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    } as const;
  }

  private resolveSameSite(
    value: string | undefined,
  ): 'lax' | 'strict' | 'none' {
    const candidate = (value ?? 'lax').toLowerCase();
    if (candidate === 'strict' || candidate === 'none' || candidate === 'lax') {
      return candidate;
    }
    return 'lax';
  }
}
