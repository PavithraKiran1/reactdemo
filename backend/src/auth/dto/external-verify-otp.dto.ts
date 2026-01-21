import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class ExternalVerifyOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Length(4, 10)
  code!: string;
}
