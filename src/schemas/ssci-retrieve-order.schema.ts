import { z } from 'zod';

export const SsciRetrieveOrderGqlSchema = z.object({
  lastName: z.string().min(1),
  recordLocator: z.string().min(1),
  headers: z.record(z.string()).optional().describe(
    'Optional header overrides (e.g. x-correlation-id, x-transaction-id). Values here override defaults.',
  ),
});

