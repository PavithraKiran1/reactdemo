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

@Controller('auth')
export class AuthController {
  constructor(
    private readonly okta: OktaOidcService,
    private readonly otc: OneTimeCodeService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * React Native starts auth by opening this URL in the system browser:
   *   https://api.company.com/auth/okta/login?redirect_uri=myapp://auth/callback
   */
  @Get('okta/login')
  async oktaLogin(@Req() req: Request, @Res() res: Response) {
    const redirectUri = (req.query.redirect_uri as string | undefined)?.trim();
    if (!redirectUri) {
      throw new BadRequestException('Missing redirect_uri');
    }

    const state = randomBytes(16).toString('hex');
    const nonce = randomBytes(16).toString('hex');

    req.session.oktaState = state;
    req.session.oktaNonce = nonce;
    req.session.oktaRedirectUri = redirectUri;

    const scope =
      this.config.get<string>('OKTA_SCOPES') ??
      'openid profile email groups';

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

    let claims: any;
    try {
      const tokenSet = await client.callback(oktaRedirectUri, params, {
        state,
        nonce,
      });
      claims = tokenSet.claims();
    } catch {
      throw new UnauthorizedException('OIDC callback validation failed');
    }

    const sub = String(claims?.sub ?? '');
    if (!sub) {
      throw new UnauthorizedException('Missing subject claim');
    }

    const email = typeof claims?.email === 'string' ? claims.email : undefined;
    const groups = Array.isArray(claims?.groups)
      ? claims.groups.map(String)
      : [];

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

    const expiresIn =
      this.config.get<string>('APP_JWT_EXPIRES_IN') ?? '15m';

    const token = await this.jwt.signAsync({
      sub: payload.sub,
      email: payload.email,
      groups: payload.groups,
    }, {
      expiresIn,
    });

    return { token, expiresIn };
  }
}

