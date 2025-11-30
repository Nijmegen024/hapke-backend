import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { VendorService } from '../vendor/vendor.service';

@Injectable()
export class MediaService {
  private supabase = createClient(
    process.env.SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE ?? '',
  );
  private bucket = process.env.SUPABASE_BUCKET ?? 'Restaurant-media';

  constructor(private readonly vendors: VendorService) {}

  async signUpload(token: string | null, originalName?: string) {
    const vendor = await this.vendors.authenticateToken(token);
    if (!vendor) {
      throw new UnauthorizedException('Ongeldige vendor');
    }

    const ext = originalName?.split('.').pop() || 'jpg';
    const filePath = `${vendor.id}/${Date.now()}.${ext}`;

    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(filePath, { upsert: false });

    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? 'Upload URL maken mislukt');
    }

    const publicUrl =
      this.supabase.storage.from(this.bucket).getPublicUrl(filePath).data
        ?.publicUrl ?? null;

    return {
      uploadUrl: data.signedUrl,
      path: filePath,
      publicUrl,
    };
  }
}
