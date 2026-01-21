import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Placeholder email sender.
 *
 * Production options:
 * - SES, SendGrid, Mailgun, O365 SMTP, etc.
 *
 * This implementation is intentionally a no-op to keep the backend runnable
 * without external credentials. In development, it can return the OTP to the caller.
 */
@Injectable()
export class EmailSenderService {
  constructor(private readonly config: ConfigService) {}

  sendOtpEmail(email: string, code: string): void {
    // PLACEHOLDER: integrate your email provider here.
    // DO NOT log codes in production.
    if (this.config.get<string>('NODE_ENV') !== 'production') {
      console.log(`[dev] OTP for ${email}: ${code}`);
    }
  }
}
