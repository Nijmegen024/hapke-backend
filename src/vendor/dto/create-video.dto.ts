import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateVideoDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(5)
  videoUrl!: string;

  @IsOptional()
  @IsString()
  thumbUrl?: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
