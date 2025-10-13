import { ArrayNotEmpty, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentItemDto } from '../../payments/dto/create-payment.dto';

export class CreateOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PaymentItemDto)
  items!: PaymentItemDto[];

  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  paymentId!: string;
}
