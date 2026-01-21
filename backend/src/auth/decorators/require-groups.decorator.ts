import { SetMetadata } from '@nestjs/common';

export const REQUIRE_GROUPS_KEY = 'require_groups';

export const RequireGroups = (...groups: string[]) =>
  SetMetadata(REQUIRE_GROUPS_KEY, groups);
