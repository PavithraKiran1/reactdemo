import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AppService } from './app.service';
import {
  AppJwtAuthGuard,
  type AppJwtRequest,
} from './auth/guards/app-jwt.guard';
import { RequireGroups } from './auth/decorators/require-groups.decorator';
import { RequireGroupsGuard } from './auth/guards/require-groups.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Example: authenticated route (your internal app JWT).
   * Call with: Authorization: Bearer <app_jwt>
   */
  @Get('me')
  @UseGuards(AppJwtAuthGuard)
  me(@Req() req: Request): AppJwtRequest['user'] {
    return (req as AppJwtRequest).user;
  }

  /**
   * Example: authenticated + authorized route (requires group).
   */
  @Get('admin/ping')
  @RequireGroups('APP_ADMIN')
  @UseGuards(AppJwtAuthGuard, RequireGroupsGuard)
  adminPing() {
    return { ok: true };
  }
}
