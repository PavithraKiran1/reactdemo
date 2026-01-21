import { IsNotEmpty, IsString } from 'class-validator';

export class MobileSessionExchangeDto {
  @IsString()
  @IsNotEmpty()
  state!: string;
}

