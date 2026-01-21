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
import { AuthSessionService } from './session/auth-session.service';
import { MobileStartDto } from './dto/mobile-start.dto';
import { MobileSessionExchangeDto } from './dto/mobile-session-exchange.dto';

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
    private readonly sessions: AuthSessionService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * New flow (RN starts at Okta hosted login page):
   *
   * 1) RN calls this endpoint to get an Okta authorize URL + state.
   * 2) RN opens authorizeUrl in WebView/InAppBrowser (Okta hosted page is shown).
   * 3) Okta redirects to OKTA_REDIRECT_URI (NestJS callback).
   * 4) RN can detect the callback navigation and then call /auth/mobile/session/exchange with the state.
   */
  @Post('mobile/start')
  async mobileStart(@Body() body: MobileStartDto) {
    const state = randomBytes(16).toString('hex');
    const nonce = randomBytes(16).toString('hex');

    await this.sessions.createPending(state, nonce);

    const scope =
      this.config.get<string>('OKTA_SCOPES') ?? 'openid profile email groups';

    const client = await this.okta.getClient();
    const authorizeUrl = client.authorizationUrl({
      scope,
      state,
      nonce,
      login_hint: body.loginHint,
    });

    return { authorizeUrl, state };
  }

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
   *
   * Supports two patterns:
   * - Existing flow: session-based (state/nonce + app deep-link redirect_uri stored in express-session)
   * - New flow: DB "session table" keyed by state (RN opened Okta directly)
   */
  @Get('okta/callback')
  async oktaCallback(@Req() req: Request, @Res() res: Response) {
    const oktaStateFromSession = req.session.oktaState;
    const oktaNonceFromSession = req.session.oktaNonce;
    const appRedirectUri = req.session.oktaRedirectUri;
    const oktaRedirectUri = this.config.get<string>('OKTA_REDIRECT_URI');

    // clear session values early (best-effort)
    delete req.session.oktaState;
    delete req.session.oktaNonce;

    if (!oktaRedirectUri) {
      throw new UnauthorizedException('Missing OKTA_REDIRECT_URI');
    }

    const usingSessionFlow = Boolean(oktaStateFromSession && oktaNonceFromSession);

    const client = await this.okta.getClient();
    const params = client.callbackParams(req);

    let claims: Record<string, unknown>;
    let state: string;
    let nonce: string;
    try {
      if (usingSessionFlow) {
        state = oktaStateFromSession as string;
        nonce = oktaNonceFromSession as string;
        if (!appRedirectUri) {
          throw new BadRequestException('Missing app redirect_uri in session');
        }
      } else {
        state = typeof req.query.state === 'string' ? req.query.state : '';
        if (!state) throw new UnauthorizedException('Missing state');
        const row = await this.sessions.findByState(state);
        if (!row || row.status !== 'PENDING') {
          throw new UnauthorizedException('Unknown or invalid auth session');
        }
        nonce = row.nonce;
      }

      const tokenSet = await client.callback(oktaRedirectUri, params, {
        state,
        nonce,
      });
      claims = tokenSet.claims() as Record<string, unknown>;
    } catch (e) {
      if (e instanceof BadRequestException || e instanceof UnauthorizedException) {
        throw e;
      }
      throw new UnauthorizedException('OIDC callback validation failed');
    }

    const sub = typeof claims.sub === 'string' ? claims.sub : '';
    if (!sub) {
      throw new UnauthorizedException('Missing subject claim');
    }

    const email = typeof claims.email === 'string' ? claims.email : undefined;
    const groups = asStringArray(claims.groups);

    if (usingSessionFlow) {
      const ttlSeconds = Number(
        this.config.get<string>('ONE_TIME_CODE_TTL_SECONDS') ?? '60',
      );
      const code = this.otc.create(
        { sub, email, groups },
        Math.max(1, ttlSeconds) * 1000,
      );

      const redirectUrl = new URL(appRedirectUri as string);
      redirectUrl.searchParams.set('code', code);
      return res.redirect(redirectUrl.toString());
    }

    const expiresIn = this.config.get<string>('APP_JWT_EXPIRES_IN') ?? '15m';
    const token = await this.jwt.signAsync({ sub, email, groups }, { expiresIn });
    const expMs = parseExpiresInToMs(expiresIn);
    await this.sessions.markAuthenticated({
      state,
      oktaSub: sub,
      email,
      groups,
      appJwt: token,
      appJwtExpiresAt: new Date(Date.now() + expMs),
    });

    return res
      .status(200)
      .type('text/html')
      .send(
        `<html><body><h3>Login complete</h3><p>You can close this window and return to the app.</p></body></html>`,
      );
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
   * New flow: mobile exchanges the DB session 'state' for the stored app JWT.
   *   POST /auth/mobile/session/exchange { state }
   */
  @Post('mobile/session/exchange')
  async mobileSessionExchange(@Body() body: MobileSessionExchangeDto) {
    const row = await this.sessions.consume(body.state);
    if (!row || !row.appJwt || !row.appJwtExpiresAt) {
      throw new UnauthorizedException('Session not authenticated or expired');
    }
    const expiresIn = this.config.get<string>('APP_JWT_EXPIRES_IN') ?? '15m';
    return { token: row.appJwt, expiresIn };
  }
}

function parseExpiresInToMs(expiresIn: string): number {
  const trimmed = expiresIn.trim();
  const match = /^(\d+)\s*([smhd]?)$/.exec(trimmed);
  if (!match) return 15 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2] || 's';
  const multiplier =
    unit === 's'
      ? 1000
      : unit === 'm'
        ? 60 * 1000
        : unit === 'h'
          ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;
  return Math.max(1, value) * multiplier;
}
