import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';

/**
 * SSCI - Regulatory Details
 *
 * Example request:
 * GET https://test-digital.etihad.com/ada-services/ssci/ey-ssci-bff-checkin/regulatory-details/v1/{id}/travelers/{travelerId}
 *
 * Configure base URL via:
 *   SSCI_REGULATORY_DETAILS_BASE_URL
 * default:
 *   https://test-digital.etihad.com/ada-services/ssci/ey-ssci-bff-checkin/regulatory-details/v1
 */

export const SsciRegulatoryDetailsSchema = z.object({
  /**
   * Optional full URL override (recommended if you already have it).
   */
  url: z.string().url().optional().describe('Optional full endpoint URL override'),
  /**
   * If `url` is not provided, these path params are used:
   *   {baseUrl}/{id}/travelers/{travelerId}
   */
  id: z.string().min(1).optional().describe('Path id (first segment after /v1/)'),
  travelerId: z.string().min(1).optional().describe('Traveler id for /travelers/{travelerId}'),
  headers: z
    .object({
      'x-correlation-id': z.string().optional(),
      'x-transaction-id': z.string().optional(),
      'x-client-application': z.string().optional(),
      'x-client-channel': z.string().optional(),
    })
    .optional()
    .describe('Optional header overrides. Values here override defaults.'),
});

export type SsciRegulatoryDetailsToolInput = z.infer<typeof SsciRegulatoryDetailsSchema>;

export const SsciRegulatoryDetailsUpdateSchema = SsciRegulatoryDetailsSchema.extend({
  /**
   * Raw JSON string body to POST.
   * Example: "{\"travelerId\":\"...\",\"detailsToAdd\":[...],\"detailsToDecline\":[]}"
   */
  rawBody: z.string().min(2).describe('Raw JSON string for request body'),
});

export type SsciRegulatoryDetailsUpdateToolInput = z.infer<typeof SsciRegulatoryDetailsUpdateSchema>;

export interface SsciRegulatoryDetailsResponse {
  [key: string]: unknown;
}

@Injectable()
export class SsciRegulatoryDetailsService {
  private readonly baseUrl =
    process.env.SSCI_REGULATORY_DETAILS_BASE_URL ??
    'https://test-digital.etihad.com/ada-services/ssci/ey-ssci-bff-checkin/regulatory-details/v1';

  private readonly defaultHeaders = {
    'x-client-application': 'SSCI',
    'x-client-channel': 'WEB',
    'x-correlation-id': 'e5cdd169-e405-4386-b00c-a69832646ee9',
    'x-transaction-id': '38786b26-c0b2-4d66-a22c-86afe73fbc0c',
  } as const;

  constructor(private readonly httpService: HttpService) {}

  private resolveUrl(params: { url?: string; id?: string; travelerId?: string }): string {
    const url = params.url
      ? params.url
      : params.id && params.travelerId
        ? `${this.baseUrl}/${encodeURIComponent(params.id)}/travelers/${encodeURIComponent(params.travelerId)}`
        : null;
    if (!url) {
      throw new Error('ssci_regulatory_details: provide either url OR (id and travelerId)');
    }
    return url;
  }

  async fetchRegulatoryDetails(params: {
    url?: string;
    id?: string;
    travelerId?: string;
    headers?: Partial<Record<string, string>>;
  }): Promise<SsciRegulatoryDetailsResponse> {
    const mergedHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...(params.headers ?? {}),
    };

    const url = this.resolveUrl(params);

    const response$ = this.httpService.get<SsciRegulatoryDetailsResponse>(url, {
      headers: mergedHeaders,
      timeout: 55_000,
    });

    const { data } = await firstValueFrom(response$);
    return data;
  }

  async updateRegulatoryDetails(params: {
    url?: string;
    id?: string;
    travelerId?: string;
    body: unknown;
    headers?: Partial<Record<string, string>>;
  }): Promise<SsciRegulatoryDetailsResponse> {
    const mergedHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...(params.headers ?? {}),
    };

    const url = this.resolveUrl(params);
    const response$ = this.httpService.post<SsciRegulatoryDetailsResponse>(url, params.body, {
      headers: mergedHeaders,
      timeout: 55_000,
    });

    const { data } = await firstValueFrom(response$);
    return data;
  }
}

type McpToolResponse = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

function toToolResponse(data: unknown): McpToolResponse {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function toToolError(message: string): McpToolResponse {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

function isMockEnabled(): boolean {
  return String(process.env.MOCK_SSCI ?? '').toLowerCase() === 'true';
}

async function maybeMockDelay(): Promise<void> {
  const ms = Number(process.env.MOCK_SSCI_DELAY_MS ?? 0);
  if (Number.isFinite(ms) && ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

function buildMockRegulatoryDetailsResponse(params: { url?: string; id?: string; travelerId?: string }) {
  return {
    ok: true,
    mocked: true,
    params,
  };
}

export const ssciRegulatoryDetailsMcpTool = {
  name: 'ssci_regulatory_details',
  definition: {
    description: 'Call SSCI Regulatory Details endpoint (GET) and return the response.',
    inputSchema: SsciRegulatoryDetailsSchema,
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  handler:
    (svc: SsciRegulatoryDetailsService) =>
    async (input: SsciRegulatoryDetailsToolInput): Promise<McpToolResponse> => {
      try {
        const { headers, url, id, travelerId } = input;

        if (isMockEnabled()) {
          await maybeMockDelay();
          return toToolResponse(buildMockRegulatoryDetailsResponse({ url, id, travelerId }));
        }

        const headerOverrides =
          headers && typeof headers === 'object'
            ? (Object.fromEntries(
                Object.entries(headers).filter(([, v]) => typeof v === 'string' && v.length > 0),
              ) as Partial<Record<string, string>>)
            : undefined;

        const apiRes = await svc.fetchRegulatoryDetails({ url, id, travelerId, headers: headerOverrides });
        return toToolResponse(apiRes);
      } catch (e: any) {
        return toToolError(e?.message ?? 'ssci_regulatory_details failed');
      }
    },
} as const;

export const ssciRegulatoryDetailsUpdateMcpTool = {
  name: 'ssci_regulatory_details_update',
  definition: {
    description:
      'Call SSCI Regulatory Details endpoint (POST) to add/decline traveler regulatory details and return the response.',
    inputSchema: SsciRegulatoryDetailsUpdateSchema,
    annotations: { readOnlyHint: false, idempotentHint: false },
  },
  handler:
    (svc: SsciRegulatoryDetailsService) =>
    async (input: SsciRegulatoryDetailsUpdateToolInput): Promise<McpToolResponse> => {
      try {
        const { headers, url, id, travelerId, rawBody } = input;

        let body: unknown;
        try {
          body = JSON.parse(rawBody);
        } catch {
          return toToolError('ssci_regulatory_details_update: rawBody must be valid JSON');
        }

        if (isMockEnabled()) {
          await maybeMockDelay();
          return toToolResponse({
            ok: true,
            mocked: true,
            params: { url, id, travelerId },
            receivedBody: body,
          });
        }

        const headerOverrides =
          headers && typeof headers === 'object'
            ? (Object.fromEntries(
                Object.entries(headers).filter(([, v]) => typeof v === 'string' && v.length > 0),
              ) as Partial<Record<string, string>>)
            : undefined;

        const apiRes = await svc.updateRegulatoryDetails({
          url,
          id,
          travelerId,
          body,
          headers: headerOverrides,
        });
        return toToolResponse(apiRes);
      } catch (e: any) {
        return toToolError(e?.message ?? 'ssci_regulatory_details_update failed');
      }
    },
} as const;

