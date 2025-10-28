import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Address } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createAddress(userId: string, dto: CreateAddressDto) {
    const addressCount = await this.prisma.address.count({ where: { userId } });
    const data: Prisma.AddressUncheckedCreateInput = {
      userId,
      street: dto.street.trim(),
      houseNumber: dto.houseNumber.trim(),
      postalCode: this.normalizePostalCode(dto.postalCode),
      city: dto.city.trim(),
      isPrimary: addressCount === 0,
    };
    if (dto.lat !== undefined) data.lat = dto.lat;
    if (dto.lng !== undefined) data.lng = dto.lng;

    const address = await this.prisma.address.create({ data });
    return this.mapAddress(address);
  }

  async listAddresses(userId: string) {
    const addresses = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
    return addresses.map((address) => this.mapAddress(address));
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ) {
    const existing = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Adres niet gevonden');
    }
    const data = this.mapUpdateDtoToData(dto);
    if (Object.keys(data).length === 0) {
      return this.mapAddress(existing);
    }
    const updated = await this.prisma.address.update({
      where: { id: addressId },
      data,
    });
    return this.mapAddress(updated);
  }

  async deleteAddress(userId: string, addressId: string) {
    await this.prisma.$transaction(async (tx) => {
      const address = await tx.address.findFirst({
        where: { id: addressId, userId },
      });
      if (!address) {
        throw new NotFoundException('Adres niet gevonden');
      }
      await tx.address.delete({ where: { id: addressId } });

      if (address.isPrimary) {
        const next = await tx.address.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        });
        if (next) {
          await tx.address.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
        }
      }
    });
  }

  async setPrimaryAddress(userId: string, addressId: string) {
    const target = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!target) {
      throw new NotFoundException('Adres niet gevonden');
    }
    if (target.isPrimary) {
      return this.mapAddress(target);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId, NOT: { id: addressId } },
        data: { isPrimary: false },
      });
      return tx.address.update({
        where: { id: addressId },
        data: { isPrimary: true },
      });
    });

    return this.mapAddress(updated);
  }

  private mapUpdateDtoToData(
    dto: UpdateAddressDto,
  ): Prisma.AddressUncheckedUpdateInput {
    const data: Prisma.AddressUncheckedUpdateInput = {};
    if (dto.street !== undefined) data.street = dto.street.trim();
    if (dto.houseNumber !== undefined)
      data.houseNumber = dto.houseNumber.trim();
    if (dto.postalCode !== undefined)
      data.postalCode = this.normalizePostalCode(dto.postalCode);
    if (dto.city !== undefined) data.city = dto.city.trim();
    if (dto.lat !== undefined) data.lat = dto.lat;
    if (dto.lng !== undefined) data.lng = dto.lng;
    return data;
  }

  private mapAddress(address: Address) {
    return {
      id: address.id,
      street: address.street,
      houseNumber: address.houseNumber,
      postalCode: address.postalCode,
      city: address.city,
      lat: address.lat,
      lng: address.lng,
      isPrimary: address.isPrimary,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }

  private normalizePostalCode(postalCode: string) {
    return postalCode.replace(/\s+/g, '').toUpperCase();
  }
}
