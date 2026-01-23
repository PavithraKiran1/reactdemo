import { z } from 'zod';

export const SsciJourneyIdentificationSchema = z.object({
  identifier: z.string().min(1).describe('Record locator / identifier'),
  lastName: z.string().min(1),
  encrypted: z.boolean(),
  firstName: z.string().nullable().optional(),
  program: z.string().nullable().optional(),
  encryptedParameters: z.unknown().nullable().optional(),
  headers: z.record(z.string()).optional().describe(
    'Optional header overrides (e.g. x-correlation-id, x-transaction-id). Values here override defaults.',
  ),
});

