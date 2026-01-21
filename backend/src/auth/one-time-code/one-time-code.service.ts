import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

export type OneTimeCodePayload = {
  sub: string;
  email?: string;
  groups: string[];
};

type Stored = {
  payload: OneTimeCodePayload;
  expiresAtMs: number;
};

@Injectable()
export class OneTimeCodeService {
  private readonly store = new Map<string, Stored>();

  /**
   * Production note: replace this in-memory map with Redis (or similar)
   * if you run multiple instances or need persistence across restarts.
   */
  create(payload: OneTimeCodePayload, ttlMs: number): string {
    const code = randomBytes(32).toString('hex');
    this.store.set(code, { payload, expiresAtMs: Date.now() + ttlMs });
    return code;
  }

  consume(code: string): OneTimeCodePayload | null {
    const stored = this.store.get(code);
    if (!stored) return null;

    // one-time use
    this.store.delete(code);

    if (Date.now() > stored.expiresAtMs) return null;
    return stored.payload;
  }
}
