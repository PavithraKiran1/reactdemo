import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { OktaOidcService } from './okta/okta-oidc.service';
import { OneTimeCodeService } from './one-time-code/one-time-code.service';
import { AppJwtAuthGuard } from './guards/app-jwt.guard';
import { RequireGroupsGuard } from './guards/require-groups.guard';
import { AuthSessionEntity } from './session/auth-session.entity';
import { AuthSessionService } from './session/auth-session.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthSessionEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('APP_JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('APP_JWT_EXPIRES_IN') ?? '15m',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    OktaOidcService,
    OneTimeCodeService,
    AuthSessionService,
    AppJwtAuthGuard,
    RequireGroupsGuard,
  ],
  exports: [
    JwtModule,
    OktaOidcService,
    OneTimeCodeService,
    AuthSessionService,
    AppJwtAuthGuard,
    RequireGroupsGuard,
  ],
})
export class AuthModule {}
