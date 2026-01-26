import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';

/**
 * SSCI - Journey Identification
 *
 * Endpoint:
 *   POST https://test-digital.etihad.com/ada-services/ssci/ey-ssci-bff-order/identification/v1/journey
 *
 * Required headers:
 *   x-client-application: SSCI
 *   x-client-channel: WEB
 *   x-correlation-id: e5cdd169-e405-4386-b00c-a69832646ee9
 *   x-transaction-id: 6724360d-b130-4bf7-97f4-d8bda4bd2c82
 */

export interface JourneyIdentificationRequestPayload {
  identifier: string;
  lastName: string;
  encrypted: boolean;
  firstName: string | null;
  program: string | null;
  encryptedParameters: unknown | null;
}

/**
 * MCP tool input schema for `ssci_identification_journey`.
 * Exported here so MCP can import it directly from the service.
 */
export const SsciJourneyIdentificationSchema = z.object({
  identifier: z.string().min(1).describe('Record locator / identifier'),
  lastName: z.string().min(1),
  // Only `identifier` and `lastName` are required for the tool caller.
  // Everything else defaults to the upstream-friendly values below.
  encrypted: z.boolean().optional().default(false),
  firstName: z.string().nullable().optional().default(null),
  program: z.string().nullable().optional().default(null),
  // Keep JSON Schema simple/valid for OpenAI tools.
  // If you need actual encrypted params later, widen this safely.
  encryptedParameters: z.null().optional().default(null),
  // NOTE: We avoid z.record(...) because it generates JSON Schema with `propertyNames`,
  // which OpenAI rejects for function parameters.
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

export type SsciJourneyIdentificationToolInput = z.infer<typeof SsciJourneyIdentificationSchema>;

export interface JourneyIdentificationResponse {
  journeys: Journey[];
  journeyDictionary?: JourneyDictionary;
  genericEligibilities?: GenericEligibility[] | null;
  warnings?: unknown[];
  errors?: unknown[];
  [key: string]: unknown;
}

export interface Journey {
  id: string;
  type?: string;
  isGroupBooking?: boolean;
  acceptance?: {
    isAccepted?: boolean;
    isPartial?: boolean;
    isVoluntaryDeniedBoarding?: boolean;
    checkedInJourneyElements?: Array<{ id: string }>;
    notCheckedInJourneyElements?: Array<{ id: string }>;
  };
  acceptanceEligibility?: {
    status?: string;
    reasons?: string[];
    eligibilityWindow?: {
      openingDateAndTime?: string;
      closingDateAndTime?: string;
    };
  };
  flights?: Array<{
    id: string;
    status?: string;
    acceptanceStatus?: string;
    aircraftCode?: string;
    marketingAirlineCode?: string;
    marketingFlightNumber?: string;
    operatingAirlineCode?: string;
    operatingAirlineFlightNumber?: string;
    operatingAirlineName?: string;
    operatingFlightNumber?: string;
    departure?: {
      dateTime?: string;
      locationCode?: string;
      terminal?: string;
    };
    arrival?: {
      dateTime?: string;
      locationCode?: string;
      terminal?: string;
    };
    duration?: number;
    isIATCI?: boolean;
    isPilgrimConfirmationRequired?: boolean;
  }>;
  journeyElements?: Array<{
    id: string;
    flightId?: string;
    orderId?: string;
    travelerId?: string;
    cabin?: string;
    checkInStatus?: string;
    boardingStatus?: string;
    boardingPassPrintStatus?: string;
    acceptanceEligibility?: {
      status?: string;
      reasons?: string[];
      eligibilityWindow?: {
        openingDateAndTime?: string;
        closingDateAndTime?: string;
      };
    };
    boardingPassEligibility?: {
      status?: string;
      reasons?: string[];
    };
    seat?: {
      seatNumber?: string;
      cabin?: string;
      seatAvailabilityStatus?: string;
      seatCharacteristicsCodes?: string[];
      isInfantAloneOnSeat?: boolean;
      isInfantOnSeat?: boolean;
    };
    seatmapEligibility?: {
      status?: string;
    };
    fareFamily?: {
      code?: string;
    };
    regulatoryProgramsCheckStatuses?: Array<{
      regulatoryProgram?: { name?: string };
      statuses?: Array<{ statusCode?: string }>;
    }>;
  }>;
  travelers?: Array<{
    id: string;
    passengerTypeCode?: string;
    gender?: string;
    dateOfBirth?: string;
    isPilgrimConfirmationProvided?: boolean;
    names?: Array<{
      nameType?: string;
      title?: string;
      firstName?: string;
      lastName?: string;
    }>;
  }>;
  contacts?: Array<{
    id?: string;
    category?: string;
    contactType?: string;
    purpose?: string;
    lang?: string;
    address?: string;
    countryPhoneExtension?: string;
    number?: string;
    travelerIds?: string[];
  }>;
  services?: Array<{
    id: string;
    travelerId?: string;
    statusCode?: string;
    quantity?: number;
    flightIds?: string[];
    descriptions?: Array<{ type?: string; content?: string }>;
  }>;
  [key: string]: unknown;
}

export interface JourneyDictionary {
  aircraft?: Record<string, string>;
  airline?: Record<string, string>;
  country?: Record<string, string>;
  flight?: Record<string, unknown>;
  journeyElement?: Record<string, unknown>;
  location?: Record<string, unknown>;
  traveler?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface GenericEligibility {
  eligiblityName: string;
  isEligible: boolean;
  journeyIds?: string[] | null;
  journeyElementIds?: string[] | null;
  [key: string]: unknown;
}

@Injectable()
export class SsciJourneyIdentificationService {
  private readonly endpointUrl =
    'https://test-digital.etihad.com/ada-services/ssci/ey-ssci-bff-order/identification/v1/journey';

  private readonly defaultHeaders = {
    'x-client-application': 'SSCI',
    'x-client-channel': 'WEB',
    'x-correlation-id': 'e5cdd169-e405-4386-b00c-a69832646ee9',
    'x-transaction-id': '6724360d-b130-4bf7-97f4-d8bda4bd2c82',
  } as const;

  constructor(private readonly httpService: HttpService) {}

  /**
   * Calls the Journey Identification endpoint.
   *
   * You can override any header (e.g. correlation/transaction id) by passing `headers`.
   */
  async fetchJourneyIdentification(
    payload: JourneyIdentificationRequestPayload,
    headers?: Partial<Record<string, string>>,
  ): Promise<JourneyIdentificationResponse> {
    const mergedHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...(headers ?? {}),
    };

    const response$ = this.httpService.post<JourneyIdentificationResponse>(
      this.endpointUrl,
      payload,
      {
        headers: mergedHeaders,
        timeout: 55_000,
      },
    );

    const { data } = await firstValueFrom(response$);
    return data;
  }

  /**
   * Convenience helper to build the example payload you provided.
   */
  buildExamplePayload(): JourneyIdentificationRequestPayload {
    return {
      identifier: '9N8DHB',
      lastName: 'Singh',
      encrypted: false,
      firstName: null,
      program: null,
      encryptedParameters: null,
    };
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

type CheckInMessage =
  | { key: 'CHECK_IN_WINDOW_UNAVAILABLE' }
  | { key: 'CHECK_IN_OPENING_TIME_UNAVAILABLE' }
  | { key: 'CHECK_IN_CLOSING_TIME_UNAVAILABLE' }
  | { key: 'CHECK_IN_UNAVAILABLE' }
  | { key: 'CHECK_IN_NOT_YET_OPEN' }
  | { key: 'CHECK_IN_OPENS_IN_MINUTES'; params: { minutes: number } }
  | { key: 'CHECK_IN_OPENS_IN_HOURS_MINUTES'; params: { hours: number; minutes: number } }
  | { key: 'CHECK_IN_OPENS_IN_DAY_HOURS'; params: { days: 1; hours: number } }
  | { key: 'CHECK_IN_OPENS_IN_DAYS_HOURS'; params: { days: number; hours: number } }
  | { key: 'CHECK_IN_OPENS_ON'; params: { date: string } }
  | { key: 'CHECK_IN_CLOSES_IN_MINUTES'; params: { minutes: number } }
  | { key: 'CHECK_IN_CLOSES_IN_HOURS_MINUTES'; params: { hours: number; minutes: number } }
  | { key: 'CHECK_IN_CLOSES_IN_DAY_HOURS'; params: { days: 1; hours: number } }
  | { key: 'CHECK_IN_CLOSES_IN_DAYS_HOURS'; params: { days: number; hours: number } }
  | { key: 'CHECK_IN_CLOSES_ON'; params: { date: string } }
  | { key: 'CHECK_IN_CLOSED_ON'; params: { date: string } };

type JourneyEligibilityResult = {
  journeyId: string;
  checkInStatus: string;
  matchedRule: string | null;
  matchedEligibility: GenericEligibility | null;
  messageKey: string | null;
  message: string | null;
  operatingAirlineName: string | null;
  checkInMessage: CheckInMessage;
};

type JourneyEligibilityResponse = {
  eligibility: { journeys: JourneyEligibilityResult[] } | null;
  error: string | null;
};

function normalizeEligibilityName(name: unknown): string {
  return String(name ?? '').trim().toLowerCase();
}

function parseIsoDateTime(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatDdMmmUtc(date: Date): string {
  // e.g. "24 Jan"
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

function computeCheckInMessage(params: {
  checkInStatus: string;
  openingDateAndTime?: unknown;
  closingDateAndTime?: unknown;
  now?: Date;
}): CheckInMessage {
  const now = params.now ?? new Date();
  const opening = parseIsoDateTime(params.openingDateAndTime);
  const closing = parseIsoDateTime(params.closingDateAndTime);

  if (!params.openingDateAndTime && !params.closingDateAndTime) {
    return { key: 'CHECK_IN_WINDOW_UNAVAILABLE' };
  }
  if (!opening) {
    return { key: 'CHECK_IN_OPENING_TIME_UNAVAILABLE' };
  }
  if (!closing) {
    return { key: 'CHECK_IN_CLOSING_TIME_UNAVAILABLE' };
  }

  // If check-in is not available for any reason, show that message regardless of window times.
  const unavailableStatuses = new Set([
    'serviceNotSupported',
    'ineligible',
    'deeplinkInhibition',
    'firstFlightOtherAirline',
    'notAvailable',
  ]);
  if (unavailableStatuses.has(params.checkInStatus)) {
    return { key: 'CHECK_IN_UNAVAILABLE' };
  }

  const nowMs = now.getTime();
  const openingMs = opening.getTime();
  const closingMs = closing.getTime();

  if (nowMs >= closingMs) {
    return { key: 'CHECK_IN_CLOSED_ON', params: { date: formatDdMmmUtc(closing) } };
  }

  if (nowMs < openingMs) {
    const secondsBeforeOpening = Math.max(0, Math.floor((openingMs - nowMs) / 1000));

    // If the opening time is far away, keep the message simple.
    if (secondsBeforeOpening >= 259200) {
      return { key: 'CHECK_IN_NOT_YET_OPEN' };
    }

    if (secondsBeforeOpening < 3600) {
      return {
        key: 'CHECK_IN_OPENS_IN_MINUTES',
        params: { minutes: Math.floor(secondsBeforeOpening / 60) },
      };
    }

    if (secondsBeforeOpening <= 108000) {
      return {
        key: 'CHECK_IN_OPENS_IN_HOURS_MINUTES',
        params: {
          hours: Math.floor(secondsBeforeOpening / 3600),
          minutes: Math.floor((secondsBeforeOpening % 3600) / 60),
        },
      };
    }

    const days = Math.floor(secondsBeforeOpening / 86400);
    const hours = Math.floor((secondsBeforeOpening % 86400) / 3600);
    if (days === 1) {
      return { key: 'CHECK_IN_OPENS_IN_DAY_HOURS', params: { days: 1, hours } };
    }
    return { key: 'CHECK_IN_OPENS_IN_DAYS_HOURS', params: { days, hours } };
  }

  // now between opening and closing
  const secondsBeforeClosing = Math.max(0, Math.floor((closingMs - nowMs) / 1000));
  if (secondsBeforeClosing < 3600) {
    return { key: 'CHECK_IN_CLOSES_IN_MINUTES', params: { minutes: Math.floor(secondsBeforeClosing / 60) } };
  }
  if (secondsBeforeClosing <= 108000) {
    return {
      key: 'CHECK_IN_CLOSES_IN_HOURS_MINUTES',
      params: {
        hours: Math.floor(secondsBeforeClosing / 3600),
        minutes: Math.floor((secondsBeforeClosing % 3600) / 60),
      },
    };
  }
  if (secondsBeforeClosing < 259200) {
    const days = Math.floor(secondsBeforeClosing / 86400);
    const hours = Math.floor((secondsBeforeClosing % 86400) / 3600);
    if (days === 1) {
      return { key: 'CHECK_IN_CLOSES_IN_DAY_HOURS', params: { days: 1, hours } };
    }
    return { key: 'CHECK_IN_CLOSES_IN_DAYS_HOURS', params: { days, hours } };
  }
  return { key: 'CHECK_IN_CLOSES_ON', params: { date: formatDdMmmUtc(closing) } };
}

function pickOperatingAirlineName(journey: Journey): string | null {
  const flights = journey.flights ?? [];
  for (const f of flights) {
    if (typeof f?.operatingAirlineName === 'string' && f.operatingAirlineName.trim().length > 0) {
      return f.operatingAirlineName;
    }
  }
  return null;
}

function computeJourneyEligibility(data: JourneyIdentificationResponse): JourneyEligibilityResponse {
  try {
    const journeys = Array.isArray(data?.journeys) ? data.journeys : [];
    const genericEligibilities = Array.isArray(data?.genericEligibilities) ? data.genericEligibilities : [];

    const rules: Array<{ ruleName: string; status: string }> = [
      { ruleName: 'IsBusJourney', status: 'busJourney' },
      { ruleName: 'IsTrainJourney', status: 'trainJourney' },
      { ruleName: 'IsFirstFlightOtherAirline', status: 'firstFlightOtherAirline' },
      { ruleName: 'IsCheckInCompleted', status: 'completed' },
      { ruleName: 'IsDeeplinkInhibition', status: 'deeplinkInhibition' },
      { ruleName: 'IsCheckInNotAvailable', status: 'notAvailable' },
      { ruleName: 'IsPartialClosedNotFlown', status: 'partialClosedNotFlown' },
      { ruleName: 'IsPartial', status: 'partial' },
      { ruleName: 'IsCheckedInAndClosedNotFlown', status: 'checkedInAndClosedNotFlown' },
      { ruleName: 'IsCheckInClosedNotFlown', status: 'closedNotFlown' },
      { ruleName: 'IsNotOpened', status: 'notOpened' },
      { ruleName: 'ServiceNotSupported', status: 'serviceNotSupported' },
      { ruleName: 'IsCheckInOpened', status: 'opened' },
    ];

    const results: JourneyEligibilityResult[] = journeys.map((journey) => {
      const journeyId = String(journey?.id ?? '');

      let checkInStatus = 'ineligible';
      let matchedRule: string | null = null;
      let matchedEligibility: GenericEligibility | null = null;

      for (const rule of rules) {
        const match = genericEligibilities.find((e) => {
          if (!e || typeof e !== 'object') return false;
          if (e.isEligible !== true) return false;
          if (normalizeEligibilityName(e.eligiblityName) !== normalizeEligibilityName(rule.ruleName)) return false;
          const ids = Array.isArray(e.journeyIds) ? e.journeyIds : [];
          return ids.includes(journeyId);
        });
        if (match) {
          checkInStatus = rule.status;
          matchedRule = rule.ruleName;
          matchedEligibility = match;
          break;
        }
      }

      const operatingAirlineName = pickOperatingAirlineName(journey);

      let messageKey: string | null = null;
      let message: string | null = null;
      if (
        checkInStatus === 'serviceNotSupported' ||
        checkInStatus === 'ineligible' ||
        checkInStatus === 'deeplinkInhibition'
      ) {
        messageKey = 'CHECK_IN_UNAVAILABLE';
        message = 'Check-in not available online, please check-in at the airport';
      } else if (checkInStatus === 'firstFlightOtherAirline') {
        messageKey = 'CHECK_IN_OTHER_AIRLINE';
        message = operatingAirlineName
          ? `Please check-in at ${operatingAirlineName} website`
          : 'Please check-in at the operating airline website';
      }

      const window = journey.acceptanceEligibility?.eligibilityWindow;
      const checkInMessage = computeCheckInMessage({
        checkInStatus,
        openingDateAndTime: window?.openingDateAndTime,
        closingDateAndTime: window?.closingDateAndTime,
      });

      return {
        journeyId,
        checkInStatus,
        matchedRule,
        matchedEligibility,
        messageKey,
        message,
        operatingAirlineName,
        checkInMessage,
      };
    });

    return { eligibility: { journeys: results }, error: null };
  } catch (e: any) {
    return { eligibility: null, error: e?.message ?? 'Failed to compute eligibility' };
  }
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

function buildMockJourneyResponse(
  identifier: string,
  lastName: string,
): JourneyIdentificationResponse {
  const isCheckInOpened =
    String(process.env.MOCK_SSCI_CHECKIN_OPENED ?? 'true').toLowerCase() === 'true';

  return {
    journeys: [
      {
        id: `MOCK-${identifier}`,
        type: 'standalone',
        isGroupBooking: false,
        acceptance: { isAccepted: false, isPartial: false, isVoluntaryDeniedBoarding: false },
        flights: [
          {
            id: 'MOCK-FLT-1',
            marketingAirlineCode: 'EY',
            marketingFlightNumber: '239',
            operatingAirlineCode: 'EY',
            operatingAirlineName: 'ETIHAD AIRWAYS',
            status: 'scheduled',
            departure: { locationCode: 'BLR', dateTime: '2026-01-23T22:00:00+05:30' },
            arrival: { locationCode: 'AUH', dateTime: '2026-01-24T00:35:00+04:00' },
          },
        ],
        travelers: [
          {
            id: 'MOCK-TRV-1',
            passengerTypeCode: 'ADT',
            names: [{ firstName: 'MOCK', lastName: lastName, title: 'MR', nameType: 'universal' }],
          },
        ],
      },
    ],
    journeyDictionary: {
      airline: { EY: 'ETIHAD AIRWAYS' },
      aircraft: { MOCK: 'MOCK AIRCRAFT' },
    },
    genericEligibilities: [
      {
        eligiblityName: 'isCheckInOpened',
        isEligible: isCheckInOpened,
        journeyIds: [`MOCK-${identifier}`],
        journeyElementIds: null,
      },
    ],
    warnings: [],
    errors: [],
  };
}

/**
 * Ready-to-register MCP tool for SSCI Journey Identification.
 * Import this object in `McpService` and register directly.
 */
export const ssciIdentificationJourneyMcpTool = {
  name: 'ssci_identification_journey',
  definition: {
    description:
      'Call SSCI Journey Identification API (POST journey) and return journeys/dictionary.',
    inputSchema: SsciJourneyIdentificationSchema,
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  handler:
    (journeyService: SsciJourneyIdentificationService) =>
    async (input: SsciJourneyIdentificationToolInput): Promise<McpToolResponse> => {
      try {
        const { headers, ...payload } = input;

        // Normalize tool input -> API payload (ensure required keys exist).
        const apiPayload: JourneyIdentificationRequestPayload = {
          identifier: payload.identifier,
          lastName: payload.lastName,
          encrypted: payload.encrypted ?? false,
          firstName: payload.firstName ?? null,
          program: payload.program ?? null,
          encryptedParameters: payload.encryptedParameters ?? null,
        };

        if (isMockEnabled()) {
          await maybeMockDelay();
          return toToolResponse(buildMockJourneyResponse(apiPayload.identifier, apiPayload.lastName));
        }

        const headerOverrides =
          headers && typeof headers === 'object'
            ? (Object.fromEntries(
                Object.entries(headers).filter(([, v]) => typeof v === 'string' && v.length > 0),
              ) as Partial<Record<string, string>>)
            : undefined;

        const apiRes = await journeyService.fetchJourneyIdentification(apiPayload, headerOverrides);
        return toToolResponse(apiRes);
      } catch (e: any) {
        return toToolError(e?.message ?? 'ssci_identification_journey failed');
      }
    },
} as const;

/**
 * MCP tool: Fetch journey then compute eligibility deterministically.
 *
 * This avoids relying on an LLM to reason about opening/closing windows, which is
 * especially error-prone once timezone offsets are involved.
 */
export const ssciIdentificationJourneyEligibilityMcpTool = {
  name: 'ssci_identification_journey_eligibility',
  definition: {
    description:
      'Call SSCI Journey Identification API and return computed check-in eligibility/messages (opens in / closed on / not open yet).',
    inputSchema: SsciJourneyIdentificationSchema,
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  handler:
    (journeyService: SsciJourneyIdentificationService) =>
    async (input: SsciJourneyIdentificationToolInput): Promise<McpToolResponse> => {
      try {
        const { headers, ...payload } = input;

        const apiPayload: JourneyIdentificationRequestPayload = {
          identifier: payload.identifier,
          lastName: payload.lastName,
          encrypted: payload.encrypted ?? false,
          firstName: payload.firstName ?? null,
          program: payload.program ?? null,
          encryptedParameters: payload.encryptedParameters ?? null,
        };

        let apiRes: JourneyIdentificationResponse;
        if (isMockEnabled()) {
          await maybeMockDelay();
          apiRes = buildMockJourneyResponse(apiPayload.identifier, apiPayload.lastName);
        } else {
          const headerOverrides =
            headers && typeof headers === 'object'
              ? (Object.fromEntries(
                  Object.entries(headers).filter(([, v]) => typeof v === 'string' && v.length > 0),
                ) as Partial<Record<string, string>>)
              : undefined;
          apiRes = await journeyService.fetchJourneyIdentification(apiPayload, headerOverrides);
        }

        return toToolResponse(computeJourneyEligibility(apiRes));
      } catch (e: any) {
        return toToolResponse({ eligibility: null, error: e?.message ?? 'ssci_identification_journey_eligibility failed' });
      }
    },
} as const;
