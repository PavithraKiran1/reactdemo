import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtService } from '@nestjs/jwt';
import { AppJwtAuthGuard } from './auth/guards/app-jwt.guard';
import { RequireGroupsGuard } from './auth/guards/require-groups.guard';
import { Reflector } from '@nestjs/core';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        Reflector,
        AppJwtAuthGuard,
        RequireGroupsGuard,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: () => ({
              sub: 'test',
              email: 'test@example.com',
              groups: [],
            }),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
