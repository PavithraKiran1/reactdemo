import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { REQUIRE_GROUPS_KEY } from '../decorators/require-groups.decorator';
import type { AppJwtRequest } from './app-jwt.guard';

@Injectable()
export class RequireGroupsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_GROUPS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const user = (req as Partial<AppJwtRequest>).user;

    const groups = user?.groups ?? [];
    const hasAny = required.some((g) => groups.includes(g));
    if (!hasAny) {
      throw new ForbiddenException('Missing required group');
    }
    return true;
  }
}
