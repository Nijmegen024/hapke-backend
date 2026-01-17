import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateRestaurantSettingsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  heroImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  lat?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  lng?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryRadiusKm?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOrderAmount!: number;
}
