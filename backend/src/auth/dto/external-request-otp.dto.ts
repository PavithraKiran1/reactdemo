import { IsEmail, IsNotEmpty } from 'class-validator';

export class ExternalRequestOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
