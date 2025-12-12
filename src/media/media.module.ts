import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { VendorModule } from '../vendor/vendor.module';

@Module({
  imports: [VendorModule],
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}
