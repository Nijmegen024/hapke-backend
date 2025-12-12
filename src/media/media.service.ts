import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { VendorService } from '../vendor/vendor.service';

@Injectable()
export class MediaService {
  private supabase;
  private bucket;
  private supabaseUrl;

  constructor(private readonly vendors: VendorService) {
    this.supabaseUrl = process.env.SUPABASE_URL ?? '';
    this.supabase = createClient(
      this.supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE ?? '',
    );
    this.bucket = process.env.SUPABASE_BUCKET ?? 'Restaurant-media';
  }

  async signUpload(token: string | null, originalName?: string) {
    const vendor = await this.vendors.authenticateToken(token);
    if (!vendor) {
      throw new UnauthorizedException('Ongeldige vendor');
    }

    const ext = originalName?.split('.').pop() || 'jpg';
    const filePath = `${vendor.id}/${Date.now()}.${ext}`;

    return this.getSignedUploadUrl(filePath);
  }

  async getSignedUploadUrl(filePath: string) {
    const { data, error } = await this.supabase
      .storage
      .from(this.bucket)
      .createSignedUploadUrl(filePath, {
        upsert: true,
      });

    if (error) {
      // log exact Supabase error
      // eslint-disable-next-line no-console
      console.error('SIGNED URL ERROR', error);
      throw new BadRequestException('Failed to create signed URL');
    }

    return {
      uploadUrl: data.signedUrl,
      publicUrl: `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${filePath}`,
    };
  }
}
