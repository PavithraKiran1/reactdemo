import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';
import { createClient, type RedisClientType } from 'redis';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function otpKey(email: string): string {
  return `otp:${normalizeEmail(email)}`;
}

function hashOtp(code: string): string {
  // We store a hash so the OTP isn't stored in plaintext.
  return createHash('sha256').update(code).digest('hex');
}

@Injectable()
export class ExternalOtpService {
  private redisClientPromise: Promise<RedisClientType> | null = null;
  private readonly memory = new Map<string, { hash: string; expMs: number }>();

  constructor(private readonly config: ConfigService) {}

  private async getRedis(): Promise<RedisClientType | null> {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    if (!url) return null;

    if (!this.redisClientPromise) {
      const client = createClient({ url });
      this.redisClientPromise = client.connect().then(() => client);
    }
    return await this.redisClientPromise;
  }

  private ttlSeconds(): number {
    return Number(this.config.get<string>('EXTERNAL_OTP_TTL_SECONDS') ?? '300');
  }

  generateCode(): string {
    // 6-digit numeric code
    return String(randomInt(0, 1000000)).padStart(6, '0');
  }

  async issue(email: string, code: string): Promise<void> {
    const ttl = Math.max(30, this.ttlSeconds());
    const key = otpKey(email);
    const hashed = hashOtp(code);

    const redis = await this.getRedis();
    if (redis) {
      await redis.set(key, hashed, { EX: ttl });
      return;
    }

    // dev-only fallback
    this.memory.set(key, { hash: hashed, expMs: Date.now() + ttl * 1000 });
  }

  async verifyAndConsume(email: string, code: string): Promise<boolean> {
    const key = otpKey(email);
    const expectedHash = hashOtp(code);

    const redis = await this.getRedis();
    if (redis) {
      const stored = await redis.get(key);
      if (!stored) return false;
      await redis.del(key); // one-time use
      return stored === expectedHash;
    }

    // dev-only fallback
    const stored = this.memory.get(key);
    if (!stored) return false;
    this.memory.delete(key);
    if (Date.now() > stored.expMs) return false;
    return stored.hash === expectedHash;
  }
}
