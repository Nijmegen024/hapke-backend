import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PaymentItemDto {
  @IsString()
  id!: string;

  @IsInt()
  @Min(1)
  qty!: number;
}

const ALLOWED_METHODS = ['ideal', 'creditcard', 'test-pay-later'] as const;

export class CreatePaymentDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PaymentItemDto)
  items!: PaymentItemDto[];

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_METHODS)
  method?: typeof ALLOWED_METHODS[number];

  @IsOptional()
  @IsString()
  redirectUrl?: string;
}
