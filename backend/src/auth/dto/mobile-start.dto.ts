import { IsOptional, IsString } from 'class-validator';

export class MobileStartDto {
  /**
   * Optional Okta login_hint (email/username) to prefill Okta hosted page.
   */
  @IsString()
  @IsOptional()
  loginHint?: string;
}

