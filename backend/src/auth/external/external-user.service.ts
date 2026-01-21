import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Placeholder for DB-backed user/role lookup for non-Okta users.
 *
 * Replace this service with your real database implementation (users table + roles/groups).
 */
@Injectable()
export class ExternalUserService {
  constructor(private readonly config: ConfigService) {}

  getGroupsForEmail(email: string): string[] {
    // Example: EXTERNAL_DEFAULT_GROUPS=APP_EXTERNAL,APP_BASIC
    const raw = this.config.get<string>('EXTERNAL_DEFAULT_GROUPS') ?? '';
    const groups = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // You can also implement allow-listing here if desired.
    // For now, all external emails get the default groups.
    void email;
    return groups;
  }
}
