import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import {
  SsciJourneyIdentificationSchema,
  SsciJourneyIdentificationService,
  type JourneyIdentificationRequestPayload,
} from './ssci-journey-identification.service';
import { SsciRetrieveOrderGqlSchema, SsciRetrieveOrderGqlService } from './ssci-retrieve-order-gql.service';

type ToolResponse = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

type McpSession = {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
};

@Injectable()
export class McpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpService.name);
  private readonly sessions = new Map<string, McpSession>();

  constructor(
    private readonly journey: SsciJourneyIdentificationService,
    private readonly order: SsciRetrieveOrderGqlService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('MCP server started (streamable HTTP). Endpoint: /mcp');
  }

  async onModuleDestroy(): Promise<void> {
    const transports = Array.from(this.sessions.values()).map((session) => session.transport);
    await Promise.all(transports.map((transport) => transport.close()));
  }

  async handleRequest(req: Request, res: Response, body?: unknown): Promise<void> {
    const sessionId = this.getSessionId(req);
    if (sessionId && this.sessions.has(sessionId)) {
      await this.sessions.get(sessionId)!.transport.handleRequest(req, res, body);
      return;
    }

    if (!sessionId && this.isInitializeRequest(body)) {
      const session = this.createSession();
      await session.server.connect(session.transport);
      await session.transport.handleRequest(req, res, body);
      return;
    }

    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: sessionId
          ? 'Bad Request: Unknown MCP session. Reinitialize.'
          : 'Bad Request: Missing MCP session. Send initialize request first.',
      },
      id: null,
    });
  }

  private createSession(): McpSession {
    const server = new McpServer({
      name: 'nest-mcp-ssci',
      version: '1.0.0',
    });
    this.registerTools(server);

    const session: McpSession = {
      server,
      transport: new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          this.sessions.set(sessionId, session);
          this.logger.log(`MCP session initialized: ${sessionId}`);
        },
      }),
    };

    session.transport.onclose = () => {
      const sid = session.transport.sessionId;
      if (sid && this.sessions.has(sid)) {
        this.sessions.delete(sid);
        this.logger.log(`MCP session closed: ${sid}`);
      }
    };

    return session;
  }

  private registerTools(server: McpServer): void {
    // ---- SSCI tools ----
    server.registerTool(
      'ssci_identification_journey',
      {
        description:
          'Call SSCI Journey Identification API (POST journey) and return journeys/dictionary.',
        inputSchema: SsciJourneyIdentificationSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async ({ headers, ...payload }: any) => {
        try {
          const apiRes = await this.journey.fetchJourneyIdentification(
            payload as JourneyIdentificationRequestPayload,
            headers,
          );
          return this.respond(apiRes);
        } catch (e: any) {
          return this.respondError(e?.message ?? 'ssci_identification_journey failed');
        }
      },
    );

    server.registerTool(
      'ssci_retrieve_order_gql',
      {
        description:
          'Call SSCI Retrieve Order GraphQL API (GetOrderData) and return getOrderData payload.',
        inputSchema: SsciRetrieveOrderGqlSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async ({ lastName, recordLocator, headers }: any) => {
        try {
          const apiRes = await this.order.fetchOrderData({ lastName, recordLocator }, headers);
          return this.respond(apiRes);
        } catch (e: any) {
          return this.respondError(e?.message ?? 'ssci_retrieve_order_gql failed');
        }
      },
    );
  }

  private getSessionId(req: Request): string | undefined {
    const header = req.headers['mcp-session-id'];
    if (Array.isArray(header)) {
      return header[0];
    }
    return header;
  }

  private isInitializeRequest(body?: unknown): boolean {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return false;
    }
    const method = (body as { method?: string }).method;
    return method === 'initialize';
  }

  private respond(data: unknown): ToolResponse {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private respondError(message: string): ToolResponse {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: message,
        },
      ],
    };
  }
}

