import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  Body,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { OktaOidcService } from './okta/okta-oidc.service';
import { OneTimeCodeService } from './one-time-code/one-time-code.service';
import { MobileExchangeDto } from './dto/mobile-exchange.dto';
import { ExternalAuthService } from './external/external-auth.service';
import { ExternalRequestOtpDto } from './dto/external-request-otp.dto';
import { ExternalVerifyOtpDto } from './dto/external-verify-otp.dto';

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === 'string' && value.length > 0) return [value];
  return [];
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly okta: OktaOidcService,
    private readonly otc: OneTimeCodeService,
    private readonly externalAuth: ExternalAuthService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * React Native starts auth by opening this URL in the system browser:
   *   https://api.company.com/auth/okta/login?redirect_uri=myapp://auth/callback
   */
  @Get('okta/login')
  async oktaLogin(@Req() req: Request, @Res() res: Response) {
    const redirectUri =
      typeof req.query.redirect_uri === 'string'
        ? req.query.redirect_uri.trim()
        : undefined;
    if (!redirectUri) {
      throw new BadRequestException('Missing redirect_uri');
    }

    const state = randomBytes(16).toString('hex');
    const nonce = randomBytes(16).toString('hex');

    req.session.oktaState = state;
    req.session.oktaNonce = nonce;
    req.session.oktaRedirectUri = redirectUri;

    const scope =
      this.config.get<string>('OKTA_SCOPES') ?? 'openid profile email groups';

    const client = await this.okta.getClient();
    const url = client.authorizationUrl({
      scope,
      state,
      nonce,
    });

    return res.redirect(url);
  }

  /**
   * Okta redirects back here after successful login.
   * NestJS exchanges the code for tokens, reads claims, then issues a one-time code
   * and redirects back to the mobile deep-link (redirect_uri).
   */
  @Get('okta/callback')
  async oktaCallback(@Req() req: Request, @Res() res: Response) {
    const state = req.session.oktaState;
    const nonce = req.session.oktaNonce;
    const appRedirectUri = req.session.oktaRedirectUri;
    const oktaRedirectUri = this.config.get<string>('OKTA_REDIRECT_URI');

    // clear session values early (best-effort)
    delete req.session.oktaState;
    delete req.session.oktaNonce;

    if (!state || !nonce || !oktaRedirectUri) {
      throw new UnauthorizedException('Missing session state/nonce');
    }
    if (!appRedirectUri) {
      throw new BadRequestException('Missing app redirect_uri in session');
    }

    const client = await this.okta.getClient();
    const params = client.callbackParams(req);

    let claims: Record<string, unknown>;
    try {
      const tokenSet = await client.callback(oktaRedirectUri, params, {
        state,
        nonce,
      });
      claims = tokenSet.claims() as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException('OIDC callback validation failed');
    }

    const sub = typeof claims.sub === 'string' ? claims.sub : '';
    if (!sub) {
      throw new UnauthorizedException('Missing subject claim');
    }

    const email = typeof claims.email === 'string' ? claims.email : undefined;
    const groups = asStringArray(claims.groups);

    const ttlSeconds = Number(
      this.config.get<string>('ONE_TIME_CODE_TTL_SECONDS') ?? '60',
    );
    const code = this.otc.create(
      { sub, email, groups },
      Math.max(1, ttlSeconds) * 1000,
    );

    const redirectUrl = new URL(appRedirectUri);
    redirectUrl.searchParams.set('code', code);
    return res.redirect(redirectUrl.toString());
  }

  /**
   * Mobile exchanges the one-time code for your internal JWT:
   *   POST /auth/mobile/exchange { code }
   */
  @Post('mobile/exchange')
  async mobileExchange(@Body() body: MobileExchangeDto) {
    const payload = this.otc.consume(body.code);
    if (!payload) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const expiresIn = this.config.get<string>('APP_JWT_EXPIRES_IN') ?? '15m';

    const token = await this.jwt.signAsync(
      {
        sub: payload.sub,
        email: payload.email,
        groups: payload.groups,
      },
      {
        expiresIn,
      },
    );

    return { token, expiresIn };
  }

  /**
   * External users (no Okta account): request an email OTP.
   * Placeholder email sender is used; in dev it can return devCode for testing.
   */
  @Post('external/request-otp')
  async externalRequestOtp(@Body() body: ExternalRequestOtpDto) {
    const result = await this.externalAuth.requestOtp(body.email);
    return { sent: true, ...result };
  }

  /**
   * External users: verify email OTP and mint the same internal app JWT.
   */
  @Post('external/verify-otp')
  async externalVerifyOtp(@Body() body: ExternalVerifyOtpDto) {
    return await this.externalAuth.verifyOtpAndMintJwt(body.email, body.code);
  }
}
