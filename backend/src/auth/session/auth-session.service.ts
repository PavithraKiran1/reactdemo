import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthSessionEntity } from './auth-session.entity';

@Injectable()
export class AuthSessionService {
  constructor(
    @InjectRepository(AuthSessionEntity)
    private readonly repo: Repository<AuthSessionEntity>,
  ) {}

  async createPending(state: string, nonce: string): Promise<AuthSessionEntity> {
    const row = this.repo.create({
      state,
      nonce,
      status: 'PENDING',
      groupsJson: '[]',
    });
    return await this.repo.save(row);
  }

  async findByState(state: string): Promise<AuthSessionEntity | null> {
    return await this.repo.findOne({ where: { state } });
  }

  async markAuthenticated(args: {
    state: string;
    oktaSub: string;
    email?: string;
    groups: string[];
    appJwt: string;
    appJwtExpiresAt: Date;
  }): Promise<void> {
    await this.repo.update(
      { state: args.state },
      {
        status: 'AUTHENTICATED',
        oktaSub: args.oktaSub,
        email: args.email ?? null,
        groupsJson: JSON.stringify(args.groups ?? []),
        appJwt: args.appJwt,
        appJwtExpiresAt: args.appJwtExpiresAt,
      },
    );
  }

  async consume(state: string): Promise<AuthSessionEntity | null> {
    const row = await this.findByState(state);
    if (!row) return null;
    if (row.status !== 'AUTHENTICATED') return null;
    if (!row.appJwt || !row.appJwtExpiresAt) return null;
    if (row.appJwtExpiresAt.getTime() <= Date.now()) return null;

    // Mark as consumed (one-time fetch from mobile exchange)
    row.status = 'CONSUMED';
    await this.repo.save(row);
    return row;
  }
}

