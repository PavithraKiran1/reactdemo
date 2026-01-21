import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { ExternalOtpService } from './external-otp.service';
import { ExternalUserService } from './external-user.service';
import { EmailSenderService } from './email-sender.service';

function externalSubject(email: string): string {
  // Stable, non-PII subject. Email still included as a claim for convenience.
  const hash = createHash('sha256')
    .update(email.trim().toLowerCase())
    .digest('hex');
  return `external-email:${hash}`;
}

@Injectable()
export class ExternalAuthService {
  constructor(
    private readonly otp: ExternalOtpService,
    private readonly users: ExternalUserService,
    private readonly emailSender: EmailSenderService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async requestOtp(email: string): Promise<{ devCode?: string }> {
    const code = this.otp.generateCode();
    await this.otp.issue(email, code);
    this.emailSender.sendOtpEmail(email, code);

    // For local testing convenience only:
    if (this.config.get<string>('NODE_ENV') !== 'production') {
      return { devCode: code };
    }
    return {};
  }

  async verifyOtpAndMintJwt(
    email: string,
    code: string,
  ): Promise<{ token: string; expiresIn: string }> {
    const ok = await this.otp.verifyAndConsume(email, code);
    if (!ok) {
      throw new UnauthorizedException('Invalid OTP');
    }

    const groups = this.users.getGroupsForEmail(email);
    const expiresIn = this.config.get<string>('APP_JWT_EXPIRES_IN') ?? '15m';
    const token = await this.jwt.signAsync(
      {
        sub: externalSubject(email),
        email: email.trim().toLowerCase(),
        groups,
        authProvider: 'external-email',
      },
      {
        expiresIn,
      },
    );

    return { token, expiresIn };
  }
}
