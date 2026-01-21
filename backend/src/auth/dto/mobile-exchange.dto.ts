import { IsNotEmpty, IsString } from 'class-validator';

export class MobileExchangeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
