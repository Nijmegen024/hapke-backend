import {
  IsEmail,
  IsString,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*\d).+$/, {
    message: 'Wachtwoord moet minimaal één cijfer bevatten',
  })
  password: string;
}
