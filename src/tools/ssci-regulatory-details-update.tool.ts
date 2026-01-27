import {
  SsciRegulatoryDetailsUpdateSchema,
  type SsciRegulatoryDetailsUpdateService,
  type SsciRegulatoryDetailsUpdateToolInput,
} from '../ssci-regulatory-details-update.service';

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

/**
 * MCP tool: POST regulatory details update (add/decline).
 */
export const ssciRegulatoryDetailsUpdateMcpTool = {
  name: 'ssci_regulatory_details_update',
  definition: {
    description:
      'Call SSCI Regulatory Details endpoint (POST) to add/decline traveler regulatory details and return the response.',
    inputSchema: SsciRegulatoryDetailsUpdateSchema,
    annotations: { readOnlyHint: false, idempotentHint: false },
  },
  handler:
    (svc: SsciRegulatoryDetailsUpdateService) =>
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

