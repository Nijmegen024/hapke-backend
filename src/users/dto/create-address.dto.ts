import { Transform, Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value.trim()
    : typeof value === 'number'
      ? String(value)
      : value;

export class CreateAddressDto {
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  street!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  houseNumber!: string;

  @Transform(trimString)
  @IsString()
  @Matches(/^[1-9][0-9]{3}\s?[A-Za-z]{2}$/, {
    message: 'Postcode moet een geldige Nederlandse postcode zijn',
  })
  postalCode!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(2)
  city!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}
