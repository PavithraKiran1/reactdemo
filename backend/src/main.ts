import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as session from 'express-session';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createClient } from 'redis';
import RedisStore from 'connect-redis';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // If you are running behind a reverse proxy / load balancer (typical in prod),
  // this is required for secure cookies to work correctly.
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Session persistence:
  // - If REDIS_URL is provided, sessions are stored in Redis (recommended for production).
  // - Otherwise, express-session falls back to in-memory MemoryStore (dev only).
  const redisUrl = process.env.REDIS_URL;
  let store: session.Store | undefined;
  if (redisUrl) {
    const redisClient = createClient({ url: redisUrl });
    await redisClient.connect();
    store = new RedisStore({
      client: redisClient,
      prefix: 'sess:',
    });
  }

  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? 'dev_session_secret_change_me',
      resave: false,
      saveUninitialized: false,
      store,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
