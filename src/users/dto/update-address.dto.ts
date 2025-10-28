import { Transform, Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { trimString } from './create-address.dto';

export class UpdateAddressDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  street?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  houseNumber?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Matches(/^[1-9][0-9]{3}\s?[A-Za-z]{2}$/)
  postalCode?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}
