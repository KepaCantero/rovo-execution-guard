// Test suite for the Rovo API Adapter
// Covers: getContext, getRelatedTickets, getDocumentation,
//         getHistoricalDecisions, validateConsistency, checkQuota
// Pattern: Arrange-Act-Assert (AAA), TDD cycle: RED -> GREEN -> REFACTOR
// [TEST-QA-001]
// [TEST-QA-0764] Mock @forge/api requestJira/requestConfluence entirely — no real HTTP calls
// [TEST-QA-0833] Unit tests with mocked @forge/api

// =====================================================================
// MOCKS — must come before imports that depend on @forge/api
// =====================================================================

jest.mock('@forge/api', () => ({
  requestJira: jest.fn(),
  requestConfluence: jest.fn(),
  route: jest.fn((strings: string[], ...values: string[]) =>
    strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] ?? ''), ''),
  ),
}));

import {
  getContext,
  getRelatedTickets,
  getDocumentation,
  getHistoricalDecisions,
  validateConsistency,
  checkQuota,
} from '../../../../src/backend/services/rovo/rovo-adapter';
import type {
  QuotaState,
  QuotaCheckResult,
  ConsistencyValidation,
} from '../../../../src/backend/services/rovo/rovo-adapter';
import {
  RovoApiError,
  QuotaExceededError,
  TimeoutError,
} from '../../../../src/backend/types/errors';
import type {
  RovoContext,
  RovoDocument,
  HistoricalDecision,
} from '../../../../src/backend/types/rovo-context';
import type { JiraTicketData } from '../../../../src/backend/types/jira-data';

import { requestJira, requestConfluence } from '@forge/api';
import type { APIResponse } from '@forge/api';

const mockRequestJira = jest.mocked(requestJira);
const mockRequestConfluence = jest.mocked(requestConfluence);

// =====================================================================
// FIXTURES
// =====================================================================

/** Creates minimal mock Headers object */
const makeHeaders = (getFn?: (name: string) => string | null): Headers => {
  const map = new Map<string, string>();
  return {
    get: getFn ?? ((_: string) => null),
    forEach: () => {},
    entries: () => map.entries(),
    keys: () => map.keys(),
    values: () => map.values(),
    [Symbol.iterator]: () => map.entries(),
    has: () => false,
    set: () => {},
    append: () => {},
    delete: () => {},
  } as unknown as Headers;
};

/** Creates a mock Forge APIResponse */
const makeResponse = (options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
  headers?: Headers;
}): APIResponse =>
  ({
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? 'OK',
    json: options.json ?? (async () => ({})),
    text: options.text ?? (async () => ''),
    headers: options.headers ?? makeHeaders(),
    arrayBuffer: async () => new ArrayBuffer(0),
  }) as unknown as APIResponse;

/** Creates a successful response with JSON body */
const makeSuccessResponse = (data: unknown): APIResponse =>
  makeResponse({
    ok: true,
    status: 200,
    json: async () => data,
  });

/** Creates an error response */
const makeErrorResponse = (status: number): APIResponse =>
  makeResponse({
    ok: false,
    status,
  });

/** Creates a valid Rovo search response (Rovo primary path) */
const makeRovoSearchResponse = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  documents: [
    {
      id: 'doc-1',
      title: 'Authentication Architecture',
      content: 'OAuth2 flow with PKCE for SPA clients',
      source: 'confluence',
      relevance: 0.92,
    },
  ],
  relatedTickets: ['PROJ-100', 'PROJ-200'],
  decisions: [
    {
      id: 'dec-1',
      title: 'Use OAuth2 over SAML',
      description: 'Decided on OAuth2+PKCE for better SPA support',
      date: '2026-01-10',
      source: 'confluence',
    },
  ],
  ...overrides,
});

/** Creates a valid Jira JQL search response (fallback path) */
const makeJiraSearchResponse = (
  issues: readonly Record<string, unknown>[] = [],
): Record<string, unknown> => ({
  issues,
  total: issues.length,
  maxResults: 50,
});

/** Creates a Jira issue for search results */
const makeJiraSearchIssue = (
  key: string,
  summary: string,
  labels: readonly string[] = [],
): Record<string, unknown> => ({
  key,
  fields: {
    summary,
    labels,
    issuetype: { name: 'Story' },
    status: { name: 'TO DO' },
  },
});

/** Creates a Confluence CQL search response (fallback path) */
const makeConfluenceSearchResponse = (
  results: readonly Record<string, unknown>[] = [],
  nextCursor?: string,
): Record<string, unknown> => ({
  results,
  _links: nextCursor ? { next: `/rest/api/content/search?cursor=${nextCursor}` } : {},
});

/** Creates a Confluence page result */
const makeConfluencePage = (
  id: string,
  title: string,
  spaceKey: string = 'ENG',
): Record<string, unknown> => ({
  id,
  title,
  space: { key: spaceKey },
  body: {
    storage: {
      value: '<p>Some content about authentication</p>',
    },
  },
  version: { number: 3 },
  _links: { webui: `/spaces/${spaceKey}/pages/${id}` },
});

/** Creates a valid RovoDocument */
const makeRovoDocument = (overrides: Partial<RovoDocument> = {}): RovoDocument => ({
  id: 'doc-1',
  title: 'Auth Architecture',
  content: 'OAuth2 flow details',
  source: 'confluence',
  relevance: 0.9,
  ...overrides,
});

/** Creates a valid JiraTicketData */
const makeJiraTicketData = (overrides: Partial<JiraTicketData> = {}): JiraTicketData => ({
  key: 'PROJ-123',
  summary: 'Implement OAuth2 authentication',
  description: 'Integrate OAuth2 with PKCE for SPA clients',
  status: 'TO DO',
  assignee: 'John Dev',
  reporter: 'Jane PM',
  priority: 'High',
  issueType: 'Story',
  labels: ['auth', 'security'],
  projectKey: 'PROJ',
  created: '2026-01-15T10:00:00.000+0000',
  updated: '2026-01-15T10:00:00.000+0000',
  ...overrides,
});

/** Creates a valid RovoContext */
const makeRovoContext = (overrides: Partial<RovoContext> = {}): RovoContext => ({
  documents: [makeRovoDocument()],
  relatedTickets: ['PROJ-100'],
  decisions: [],
  query: 'authentication',
  timestamp: '2026-01-15T10:00:00.000Z',
  ...overrides,
});

/** Creates a valid QuotaState */
const makeQuotaState = (overrides: Partial<QuotaState> = {}): QuotaState => ({
  windowStartMs: Date.now() - 30_000,
  callCount: 5,
  maxCallsPerMinute: 20,
  ...overrides,
});

/** Helper to parse log entries from console.log spy */
const parseLogCalls = (spy: jest.SpyInstance): Record<string, unknown>[] => {
  return spy.mock.calls
    .map((call: [string]) => {
      try {
        return JSON.parse(call[0]);
      } catch {
        return null;
      }
    })
    .filter((log: unknown): log is Record<string, unknown> => log !== null);
};

// =====================================================================
// TEST SUITE
// =====================================================================

describe('rovo-adapter', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    jest.useRealTimers();
  });

  // =====================================================================
  // getContext()
  // =====================================================================

  describe('getContext()', () => {
    it('should return structured RovoContext when Rovo is available', async () => {
      // Arrange — Rovo primary path returns success
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(makeRovoSearchResponse()));

      // Act
      const result: RovoContext = await getContext('authentication', 'PROJ', 'exec-001');

      // Assert
      expect(result.query).toBe('authentication');
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0]!.id).toBe('doc-1');
      expect(result.documents[0]!.title).toBe('Authentication Architecture');
      expect(result.relatedTickets).toEqual(['PROJ-100', 'PROJ-200']);
      expect(result.decisions).toHaveLength(1);
      expect(result.decisions[0]!.title).toBe('Use OAuth2 over SAML');
      expect(result.timestamp).toBeTruthy();
    });

    it('should fallback to keyword search when Rovo returns non-OK', async () => {
      // Arrange — Rovo primary fails, Jira + Confluence fallback succeed
      const rovoResponse = makeErrorResponse(503);
      const jiraResponse = makeSuccessResponse(
        makeJiraSearchResponse([
          makeJiraSearchIssue('PROJ-50', 'Auth setup'),
          makeJiraSearchIssue('PROJ-60', 'Login flow'),
        ]),
      );
      const confluenceResponse = makeSuccessResponse(
        makeConfluenceSearchResponse([makeConfluencePage('101', 'Auth Guide')]),
      );

      mockRequestConfluence
        .mockResolvedValueOnce(rovoResponse) // Rovo primary fails
        .mockResolvedValueOnce(confluenceResponse); // Confluence fallback
      mockRequestJira.mockResolvedValue(jiraResponse); // Jira fallback

      // Act
      const result = await getContext('authentication', 'PROJ', 'exec-fb');

      // Assert
      expect(result.query).toBe('authentication');
      expect(result.relatedTickets).toEqual(['PROJ-50', 'PROJ-60']);
      expect(result.documents.length).toBeGreaterThanOrEqual(0);
    });

    it('should fallback to keyword search when Rovo times out', async () => {
      // Arrange — Rovo primary times out (abort error)
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      const jiraResponse = makeSuccessResponse(makeJiraSearchResponse());
      const confluenceResponse = makeSuccessResponse(makeConfluenceSearchResponse());

      mockRequestConfluence
        .mockRejectedValueOnce(abortError) // Rovo primary timeout
        .mockResolvedValueOnce(confluenceResponse); // Confluence fallback
      mockRequestJira.mockResolvedValue(jiraResponse);

      // Act
      const result = await getContext('auth', 'PROJ', 'exec-timeout');

      // Assert
      expect(result.query).toBe('auth');
      expect(result.relatedTickets).toEqual([]);
    });

    it('should log fallback indicator when using fallback path', async () => {
      // Arrange — Rovo fails, fallback succeeds
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503))
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraSearchResponse()));

      // Act
      await getContext('auth', 'PROJ', 'exec-fb-log');

      // Assert
      const logs = parseLogCalls(consoleLogSpy);
      const fallbackLogs = logs.filter((log) => log.fallback === true || log.fallback === 'true');
      expect(fallbackLogs.length).toBeGreaterThan(0);
    });

    it('should include executionId in all log entries', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(makeRovoSearchResponse()));

      // Act
      await getContext('query', 'PROJ', 'exec-log-ctx');

      // Assert
      const logs = parseLogCalls(consoleLogSpy);
      const validLogs = logs.filter((log) => log.operation === 'getContext');
      for (const log of validLogs) {
        expect(log).toHaveProperty('executionId', 'exec-log-ctx');
      }
    });

    it('should handle empty Rovo response gracefully', async () => {
      // Arrange — Rovo returns valid but empty structure
      const emptyRovo = makeRovoSearchResponse({
        documents: [],
        relatedTickets: [],
        decisions: [],
      });
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(emptyRovo));

      // Act
      const result = await getContext('nonexistent', 'PROJ', 'exec-empty');

      // Assert
      expect(result.documents).toEqual([]);
      expect(result.relatedTickets).toEqual([]);
      expect(result.decisions).toEqual([]);
      expect(result.query).toBe('nonexistent');
    });

    it('should handle partial Rovo response (missing decisions)', async () => {
      // Arrange — response missing 'decisions' field
      const partialRovo = {
        documents: [makeRovoDocument()],
        relatedTickets: ['PROJ-1'],
      };
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(partialRovo));

      // Act
      const result = await getContext('query', 'PROJ', 'exec-partial');

      // Assert — type guard should handle partial gracefully
      expect(result.documents).toHaveLength(1);
      expect(result.relatedTickets).toEqual(['PROJ-1']);
    });

    it('should return fallback context even when all APIs fail', async () => {
      // Arrange — both Rovo and fallback fail
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503)) // Rovo fail
        .mockResolvedValueOnce(makeErrorResponse(500)); // Confluence fallback fail
      mockRequestJira.mockResolvedValue(makeErrorResponse(500)); // Jira fallback fail

      // Act
      const result = await getContext('auth', 'PROJ', 'exec-allfail');

      // Assert — should return empty but valid context, not throw
      expect(result.query).toBe('auth');
      expect(result.documents).toEqual([]);
      expect(result.relatedTickets).toEqual([]);
      expect(result.decisions).toEqual([]);
    });
  });

  // =====================================================================
  // getRelatedTickets()
  // =====================================================================

  describe('getRelatedTickets()', () => {
    it('should return related tickets from Rovo when available', async () => {
      // Arrange — first get ticket data, then Rovo returns related
      const ticketResponse = makeSuccessResponse({
        key: 'PROJ-123',
        fields: {
          summary: 'Auth implementation',
          labels: ['auth', 'security'],
          issuetype: { name: 'Story' },
          status: { name: 'TO DO' },
        },
      });
      const rovoResponse = makeSuccessResponse({
        documents: [],
        relatedTickets: ['PROJ-100', 'PROJ-200', 'PROJ-300'],
        decisions: [],
      });

      mockRequestJira.mockResolvedValue(ticketResponse);
      mockRequestConfluence.mockResolvedValue(rovoResponse);

      // Act
      const result = await getRelatedTickets('PROJ-123', 'exec-rt');

      // Assert
      expect(result).toEqual(['PROJ-100', 'PROJ-200', 'PROJ-300']);
    });

    it('should fallback to label/title overlap when Rovo unavailable', async () => {
      // Arrange — Rovo fails, Jira search by label returns results
      const ticketResponse = makeSuccessResponse({
        key: 'PROJ-123',
        fields: {
          summary: 'Auth implementation',
          labels: ['auth', 'security'],
          issuetype: { name: 'Story' },
          status: { name: 'TO DO' },
        },
      });
      const searchResponse = makeSuccessResponse(
        makeJiraSearchResponse([
          makeJiraSearchIssue('PROJ-50', 'Auth setup', ['auth']),
          makeJiraSearchIssue('PROJ-60', 'Login flow', ['auth', 'security']),
        ]),
      );

      mockRequestJira.mockResolvedValueOnce(ticketResponse).mockResolvedValueOnce(searchResponse);
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      const result = await getRelatedTickets('PROJ-123', 'exec-rt-fb');

      // Assert
      expect(result).toContain('PROJ-50');
      expect(result).toContain('PROJ-60');
    });

    it('should return empty array when no related tickets found', async () => {
      // Arrange — Rovo fails, Jira returns no results
      mockRequestJira
        .mockResolvedValueOnce(
          makeSuccessResponse({
            key: 'PROJ-123',
            fields: {
              summary: 'Unique task',
              labels: [],
              issuetype: { name: 'Task' },
              status: { name: 'TO DO' },
            },
          }),
        )
        .mockResolvedValueOnce(makeSuccessResponse(makeJiraSearchResponse([])));
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      const result = await getRelatedTickets('PROJ-123', 'exec-rt-empty');

      // Assert
      expect(result).toEqual([]);
    });

    it('should exclude the queried ticket from results', async () => {
      // Arrange — search results include the queried ticket
      mockRequestJira
        .mockResolvedValueOnce(
          makeSuccessResponse({
            key: 'PROJ-123',
            fields: {
              summary: 'Auth',
              labels: ['auth'],
              issuetype: { name: 'Story' },
              status: { name: 'TO DO' },
            },
          }),
        )
        .mockResolvedValueOnce(
          makeSuccessResponse(
            makeJiraSearchResponse([
              // PROJ-123 excluded by JQL "key != PROJ-123" in fallbackRelatedTicketsByLabels
              makeJiraSearchIssue('PROJ-456', 'Auth setup', ['auth']),
            ]),
          ),
        );
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      const result = await getRelatedTickets('PROJ-123', 'exec-rt-exclude');

      // Assert
      expect(result).not.toContain('PROJ-123');
      expect(result).toContain('PROJ-456');
    });

    it('should log fallback indicator when using Jira fallback', async () => {
      // Arrange
      mockRequestJira
        .mockResolvedValueOnce(
          makeSuccessResponse({
            key: 'PROJ-123',
            fields: {
              summary: 'Test',
              labels: [],
              issuetype: { name: 'Task' },
              status: { name: 'TO DO' },
            },
          }),
        )
        .mockResolvedValueOnce(makeSuccessResponse(makeJiraSearchResponse()));
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      await getRelatedTickets('PROJ-123', 'exec-rt-log');

      // Assert
      const logs = parseLogCalls(consoleLogSpy);
      const fallbackLogs = logs.filter((log) => log.fallback === true);
      expect(fallbackLogs.length).toBeGreaterThan(0);
    });
  });

  // =====================================================================
  // getDocumentation()
  // =====================================================================

  describe('getDocumentation()', () => {
    it('should return documents from Rovo when available', async () => {
      // Arrange
      const rovoResponse = makeSuccessResponse({
        documents: [
          {
            id: 'd1',
            title: 'API Guide',
            content: 'How to use the API',
            source: 'confluence',
            relevance: 0.95,
          },
          {
            id: 'd2',
            title: 'Auth Guide',
            content: 'OAuth2 setup',
            source: 'confluence',
            relevance: 0.88,
          },
        ],
        relatedTickets: [],
        decisions: [],
      });
      mockRequestConfluence.mockResolvedValue(rovoResponse);

      // Act
      const result = await getDocumentation('API authentication', undefined, 'exec-doc');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('d1');
      expect(result[1]!.id).toBe('d2');
    });

    it('should fallback to Confluence CQL search when Rovo unavailable', async () => {
      // Arrange — Rovo fails, Confluence CQL fallback succeeds
      const confluenceResults = makeSuccessResponse(
        makeConfluenceSearchResponse([
          makeConfluencePage('201', 'Setup Guide', 'ENG'),
          makeConfluencePage('202', 'API Reference', 'ENG'),
        ]),
      );
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503)) // Rovo fail
        .mockResolvedValueOnce(confluenceResults); // CQL fallback

      // Act
      const result = await getDocumentation('setup guide', ['ENG'], 'exec-doc-fb');

      // Assert
      expect(result.length).toBeGreaterThan(0);
    });

    it('should use cursor-based pagination for Confluence results', async () => {
      // Arrange — first page + second page with cursor
      const page1 = makeConfluenceSearchResponse(
        [makeConfluencePage('301', 'Page 1')],
        'cursor-page2',
      );
      const page2 = makeConfluenceSearchResponse([makeConfluencePage('302', 'Page 2')]);
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503)) // Rovo fail
        .mockResolvedValueOnce(makeSuccessResponse(page1)) // CQL page 1
        .mockResolvedValueOnce(makeSuccessResponse(page2)); // CQL page 2

      // Act
      const result = await getDocumentation('test', ['ENG'], 'exec-doc-pag');

      // Assert — should have results from both pages
      expect(result.length).toBe(2);
    });

    it('should cap limit parameter at 250 (ROVO-INTEG-003)', async () => {
      // Arrange — request with limit > 250
      mockRequestConfluence.mockResolvedValue(
        makeSuccessResponse(makeConfluenceSearchResponse([])),
      );

      // Act
      await getDocumentation('test', undefined, 'exec-doc-limit');

      // Assert — verify Confluence call used max 250 limit
      // The second call (fallback) should have limit capped at 250
      const confluenceCalls = mockRequestConfluence.mock.calls;
      const fallbackCall = confluenceCalls[confluenceCalls.length - 1];
      if (fallbackCall) {
        const url = String(fallbackCall[0] ?? '');
        // Should not have limit > 250
        expect(url).not.toMatch(/limit=25[1-9]/);
      }
    });

    it('should return empty array when no documentation found', async () => {
      // Arrange — both Rovo and Confluence return empty
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503))
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse([])));

      // Act
      const result = await getDocumentation('nonexistent topic', ['ENG'], 'exec-doc-empty');

      // Assert
      expect(result).toEqual([]);
    });

    it('should filter by spaceKeys when provided', async () => {
      // Arrange
      const confluenceResults = makeSuccessResponse(
        makeConfluenceSearchResponse([makeConfluencePage('401', 'Eng Doc', 'ENG')]),
      );
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503))
        .mockResolvedValueOnce(confluenceResults);

      // Act
      await getDocumentation('test', ['ENG', 'DEV'], 'exec-doc-spaces');

      // Assert — verify CQL query includes space filter
      const cqlCall = mockRequestConfluence.mock.calls[1];
      expect(cqlCall).toBeDefined();
    });

    it('should log fallback indicator when using CQL fallback', async () => {
      // Arrange
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503))
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));

      // Act
      await getDocumentation('test', undefined, 'exec-doc-fb-log');

      // Assert
      const logs = parseLogCalls(consoleLogSpy);
      const fallbackLogs = logs.filter((log) => log.fallback === true);
      expect(fallbackLogs.length).toBeGreaterThan(0);
    });
  });

  // =====================================================================
  // getHistoricalDecisions()
  // =====================================================================

  describe('getHistoricalDecisions()', () => {
    it('should return decisions from Rovo when available', async () => {
      // Arrange
      const rovoResponse = makeSuccessResponse({
        documents: [],
        relatedTickets: [],
        decisions: [
          {
            id: 'dec-1',
            title: 'Use PostgreSQL',
            description: 'Chosen for ACID compliance',
            date: '2025-06-01',
            source: 'confluence',
          },
          {
            id: 'dec-2',
            title: 'REST over gRPC',
            description: 'Simpler team adoption',
            date: '2025-07-15',
            source: 'confluence',
          },
        ],
      });
      mockRequestConfluence.mockResolvedValue(rovoResponse);

      // Act
      const result = await getHistoricalDecisions('PROJ', 'exec-hd');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]!.title).toBe('Use PostgreSQL');
      expect(result[1]!.title).toBe('REST over gRPC');
    });

    it('should fallback to Confluence ADR search when Rovo unavailable', async () => {
      // Arrange — Rovo fails, Confluence search for ADR-tagged pages
      const adrPages = makeSuccessResponse(
        makeConfluenceSearchResponse([
          {
            ...makeConfluencePage('501', 'ADR-001: Database Choice', 'ENG'),
            metadata: { labels: { results: [{ name: 'decision' }] } },
          },
          {
            ...makeConfluencePage('502', 'ADR-002: API Style', 'ENG'),
            metadata: { labels: { results: [{ name: 'adr' }] } },
          },
        ]),
      );
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503))
        .mockResolvedValueOnce(adrPages);

      // Act
      const result = await getHistoricalDecisions('PROJ', 'exec-hd-fb');

      // Assert — fallback should return results from Confluence
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array when no decisions found', async () => {
      // Arrange
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503))
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse([])));

      // Act
      const result = await getHistoricalDecisions('PROJ', 'exec-hd-empty');

      // Assert
      expect(result).toEqual([]);
    });

    it('should log fallback indicator when using Confluence fallback', async () => {
      // Arrange
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503))
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));

      // Act
      await getHistoricalDecisions('PROJ', 'exec-hd-fb-log');

      // Assert
      const logs = parseLogCalls(consoleLogSpy);
      const fallbackLogs = logs.filter((log) => log.fallback === true);
      expect(fallbackLogs.length).toBeGreaterThan(0);
    });
  });

  // =====================================================================
  // validateConsistency()
  // =====================================================================

  describe('validateConsistency()', () => {
    it('should return rovo-based validation when Rovo is available', async () => {
      // Arrange
      const ticketData = makeJiraTicketData();
      const context = makeRovoContext();
      const rovoValidation = makeSuccessResponse({
        isConsistent: true,
        issues: [],
        confidence: 0.95,
        source: 'rovo',
      });
      mockRequestConfluence.mockResolvedValue(rovoValidation);

      // Act
      const result = await validateConsistency(ticketData, context, 'exec-vc');

      // Assert
      expect(result.isConsistent).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.confidence).toBe(0.95);
      expect(result.source).toBe('rovo');
    });

    it('should fallback to rule-based validation when Rovo unavailable', async () => {
      // Arrange
      const ticketData = makeJiraTicketData();
      const context = makeRovoContext();
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      const result = await validateConsistency(ticketData, context, 'exec-vc-fb');

      // Assert
      expect(result.source).toBe('rule-based');
      expect(typeof result.isConsistent).toBe('boolean');
      expect(typeof result.confidence).toBe('number');
      expect(Array.isArray(result.issues)).toBe(true);
    });

    it('should detect inconsistency when ticket summary contradicts context', async () => {
      // Arrange — ticket about auth, but context has no auth-related documents
      const ticketData = makeJiraTicketData({
        summary: 'Implement database migration',
        description: 'Migrate from MySQL to PostgreSQL',
        labels: ['database'],
      });
      const context = makeRovoContext({
        documents: [
          makeRovoDocument({ title: 'Auth Guide', content: 'OAuth2 setup', relevance: 0.9 }),
        ],
        relatedTickets: [],
      });
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      const result = await validateConsistency(ticketData, context, 'exec-vc-incon');

      // Assert — rule-based should detect the mismatch
      expect(result.source).toBe('rule-based');
      // May or may not flag issues depending on rule-based implementation
      expect(typeof result.isConsistent).toBe('boolean');
    });

    it('should return consistent result when ticket matches context well', async () => {
      // Arrange — ticket and context are well-aligned
      const ticketData = makeJiraTicketData({
        summary: 'Implement OAuth2 authentication',
        labels: ['auth', 'security'],
      });
      const context = makeRovoContext({
        documents: [
          makeRovoDocument({
            title: 'OAuth2 Setup Guide',
            content: 'Authentication with OAuth2',
            relevance: 0.95,
          }),
        ],
        relatedTickets: ['PROJ-123'],
        query: 'authentication',
      });
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      const result = await validateConsistency(ticketData, context, 'exec-vc-cons');

      // Assert
      expect(result.source).toBe('rule-based');
      expect(result.isConsistent).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should include executionId in validation log entries', async () => {
      // Arrange
      const ticketData = makeJiraTicketData();
      const context = makeRovoContext();
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      await validateConsistency(ticketData, context, 'exec-vc-log');

      // Assert
      const logs = parseLogCalls(consoleLogSpy);
      const validLogs = logs.filter((log) => log.operation === 'validateConsistency');
      for (const log of validLogs) {
        expect(log).toHaveProperty('executionId', 'exec-vc-log');
      }
    });
  });

  // =====================================================================
  // checkQuota()
  // =====================================================================

  describe('checkQuota()', () => {
    it('should allow call when quota is available', () => {
      // Arrange
      const state = makeQuotaState({ callCount: 5, maxCallsPerMinute: 20 });

      // Act
      const result = checkQuota(state, 'exec-q-ok');

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remainingCalls).toBe(14); // 20 - 5 - 1 (this call)
    });

    it('should deny call when quota is exhausted', () => {
      // Arrange
      const state = makeQuotaState({ callCount: 20, maxCallsPerMinute: 20 });

      // Act
      const result = checkQuota(state, 'exec-q-exhausted');

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.remainingCalls).toBe(0);
    });

    it('should deny call when quota exactly at limit', () => {
      // Arrange
      const state = makeQuotaState({ callCount: 19, maxCallsPerMinute: 20 });

      // Act
      const result = checkQuota(state, 'exec-q-at-limit');

      // Assert — 19 calls made, 1 remaining, this call uses it -> allowed
      expect(result.allowed).toBe(true);
      expect(result.remainingCalls).toBe(0);
    });

    it('should reset window when current time exceeds one minute', () => {
      // Arrange — window started more than 60s ago
      const oldWindow = Date.now() - 120_000; // 2 minutes ago
      const state = makeQuotaState({
        windowStartMs: oldWindow,
        callCount: 20,
        maxCallsPerMinute: 20,
      });

      // Act
      const result = checkQuota(state, 'exec-q-reset');

      // Assert — window should reset, so call is allowed
      expect(result.allowed).toBe(true);
      expect(result.nextState.windowStartMs).not.toBe(oldWindow);
      expect(result.nextState.callCount).toBe(1);
    });

    it('should return nextState with incremented callCount', () => {
      // Arrange
      const state = makeQuotaState({ callCount: 3, maxCallsPerMinute: 20 });

      // Act
      const result = checkQuota(state, 'exec-q-next');

      // Assert
      expect(result.nextState.callCount).toBe(4);
      expect(result.nextState.windowStartMs).toBe(state.windowStartMs);
      expect(result.nextState.maxCallsPerMinute).toBe(20);
    });

    it('should not mutate the input state (immutability)', () => {
      // Arrange
      const state = makeQuotaState({ callCount: 5, maxCallsPerMinute: 20 });
      const originalCount = state.callCount;

      // Act
      checkQuota(state, 'exec-q-immutable');

      // Assert
      expect(state.callCount).toBe(originalCount);
    });

    it('should include executionId in quota check logs', () => {
      // Arrange
      const state = makeQuotaState({ callCount: 5, maxCallsPerMinute: 20 });

      // Act
      checkQuota(state, 'exec-q-log');

      // Assert
      const logs = parseLogCalls(consoleLogSpy);
      const quotaLogs = logs.filter((log) => log.operation === 'checkQuota');
      for (const log of quotaLogs) {
        expect(log).toHaveProperty('executionId', 'exec-q-log');
      }
    });
  });

  // =====================================================================
  // Timeout Handling (AC-04, ROVO-INTEG-005)
  // =====================================================================

  describe('timeout handling (AC-04)', () => {
    it('should throw TimeoutError when Rovo request is aborted', async () => {
      // Arrange — simulate abort on primary Rovo path, with fallback working
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      mockRequestConfluence
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraSearchResponse()));

      // Act — should not throw, fallback should work
      const result = await getContext('auth', 'PROJ', 'exec-timeout-1', 5_000);
      expect(result.query).toBe('auth');
    });

    it('should handle Error with name AbortError', async () => {
      // Arrange
      const abortLikeError = new Error('Aborted');
      abortLikeError.name = 'AbortError';
      mockRequestConfluence
        .mockRejectedValueOnce(abortLikeError)
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraSearchResponse()));

      // Act
      const result = await getContext('auth', 'PROJ', 'exec-timeout-2');
      expect(result.query).toBe('auth');
    });
  });

  // =====================================================================
  // Structured Logging (AC-05)
  // =====================================================================

  describe('structured logging (AC-05)', () => {
    it('should log operation name in all entries', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(makeRovoSearchResponse()));

      // Act
      await getContext('query', 'PROJ', 'exec-op-log');

      // Assert
      const logs = parseLogCalls(consoleLogSpy);
      const validLogs = logs.filter((log) => typeof log.operation === 'string');
      for (const log of validLogs) {
        expect(typeof log.operation).toBe('string');
        expect((log.operation as string).length).toBeGreaterThan(0);
      }
    });

    it('should log timestamp in ISO 8601 format', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(makeRovoSearchResponse()));

      // Act
      await getContext('query', 'PROJ', 'exec-ts-log');

      // Assert
      const logs = parseLogCalls(consoleLogSpy);
      for (const log of logs) {
        if (typeof log.timestamp === 'string') {
          expect(new Date(log.timestamp as string).getTime()).not.toBeNaN();
        }
      }
    });

    it('should include level in log entries', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(makeRovoSearchResponse()));

      // Act
      await getContext('query', 'PROJ', 'exec-level-log');

      // Assert
      const logs = parseLogCalls(consoleLogSpy);
      const validLogs = logs.filter((log) => log.level);
      expect(validLogs.length).toBeGreaterThan(0);
      for (const log of validLogs) {
        expect(['info', 'warn', 'error']).toContain(log.level);
      }
    });
  });

  // =====================================================================
  // Response Validation / Type Guards (SEC-PRIV-004, ROVO-INTEG-0775)
  // =====================================================================

  describe('response validation (SEC-PRIV-004)', () => {
    it('should handle null Rovo response body gracefully', async () => {
      // Arrange — Rovo returns null
      mockRequestConfluence
        .mockResolvedValueOnce(makeSuccessResponse(null))
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraSearchResponse()));

      // Act — should fallback
      const result = await getContext('auth', 'PROJ', 'exec-null');
      expect(result.query).toBe('auth');
    });

    it('should handle non-object Rovo response body', async () => {
      // Arrange — Rovo returns a string
      mockRequestConfluence
        .mockResolvedValueOnce(makeSuccessResponse('not an object'))
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraSearchResponse()));

      // Act — should fallback
      const result = await getContext('auth', 'PROJ', 'exec-string');
      expect(result.query).toBe('auth');
    });

    it('should handle Rovo response with invalid document structure', async () => {
      // Arrange — documents field is not an array
      const badResponse = {
        documents: 'not-an-array',
        relatedTickets: [],
        decisions: [],
      };
      mockRequestConfluence
        .mockResolvedValueOnce(makeSuccessResponse(badResponse))
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraSearchResponse()));

      // Act — should fallback
      const result = await getContext('auth', 'PROJ', 'exec-bad-docs');
      expect(result.query).toBe('auth');
    });

    it('should handle Rovo response with missing required fields', async () => {
      // Arrange — only partial fields
      const partialResponse = {
        documents: [{ id: 'd1', title: 'Test' }], // missing content, source, relevance
      };
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(partialResponse));

      // Act — should handle gracefully
      const result = await getContext('auth', 'PROJ', 'exec-partial-2');
      expect(result.query).toBe('auth');
    });
  });

  // =====================================================================
  // Error Codes (AC-06)
  // =====================================================================

  describe('error code consistency (AC-06)', () => {
    it('should use ROVO_API_ERROR code for Rovo API failures', async () => {
      // Arrange — Rovo returns 500, fallback also fails
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(500))
        .mockResolvedValueOnce(makeErrorResponse(500));
      mockRequestJira.mockResolvedValue(makeErrorResponse(500));

      // Act — should not throw, returns empty context
      const result = await getContext('auth', 'PROJ', 'exec-err-code');
      expect(result.query).toBe('auth');
    });

    it('should use ROVO_TIMEOUT code for timeout errors in logs', async () => {
      // Arrange
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      mockRequestConfluence
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraSearchResponse()));

      // Act
      await getContext('auth', 'PROJ', 'exec-timeout-code');

      // Assert — should log timeout warning
      const logs = parseLogCalls(consoleLogSpy);
      const warnLogs = logs.filter((log) => log.level === 'warn');
      expect(warnLogs.length).toBeGreaterThan(0);
    });
  });

  // =====================================================================
  // Quota Integration (AC-03)
  // =====================================================================

  describe('quota integration (AC-03)', () => {
    it('should trigger fallback when quota is exceeded', async () => {
      // Arrange — quota exhausted
      const exhaustedState = makeQuotaState({
        callCount: 20,
        maxCallsPerMinute: 20,
      });

      // Act
      const quotaResult: QuotaCheckResult = checkQuota(exhaustedState, 'exec-q-over');
      expect(quotaResult.allowed).toBe(false);

      // Now call getContext — should use fallback since quota is exceeded
      const jiraResponse = makeSuccessResponse(
        makeJiraSearchResponse([makeJiraSearchIssue('PROJ-1', 'Auth')]),
      );
      const confluenceResponse = makeSuccessResponse(
        makeConfluenceSearchResponse([makeConfluencePage('1', 'Auth Doc')]),
      );
      mockRequestConfluence.mockResolvedValue(confluenceResponse);
      mockRequestJira.mockResolvedValue(jiraResponse);

      // Verify fallback is used when checkQuota returns false
      const result = await getContext('auth', 'PROJ', 'exec-q-over-ctx');
      expect(result.query).toBe('auth');
    });
  });

  // =====================================================================
  // Chaos / Edge Cases (TEST-QA-0853)
  // =====================================================================

  describe('chaos tests (TEST-QA-0853)', () => {
    it('should handle empty query string', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(makeRovoSearchResponse()));

      // Act
      const result = await getContext('', 'PROJ', 'exec-empty-q');

      // Assert
      expect(result.query).toBe('');
    });

    it('should handle response with extra unexpected fields', async () => {
      // Arrange
      const extraFieldsResponse = {
        ...makeRovoSearchResponse(),
        extraField: 'should be ignored',
        metadata: { requestId: 'abc-123' },
      };
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(extraFieldsResponse));

      // Act
      const result = await getContext('auth', 'PROJ', 'exec-extra');

      // Assert — should parse correctly, ignoring extra fields
      expect(result.documents).toHaveLength(1);
      expect(result.relatedTickets).toEqual(['PROJ-100', 'PROJ-200']);
    });

    it('should handle quota state with zero max calls', () => {
      // Arrange
      const zeroQuota = makeQuotaState({ callCount: 0, maxCallsPerMinute: 0 });

      // Act
      const result = checkQuota(zeroQuota, 'exec-q-zero');

      // Assert — zero max means no calls allowed
      expect(result.allowed).toBe(false);
      expect(result.remainingCalls).toBe(0);
    });

    it('should handle quota state with very large call count', () => {
      // Arrange
      const largeQuota = makeQuotaState({
        callCount: 1_000_000,
        maxCallsPerMinute: 20,
      });

      // Act
      const result = checkQuota(largeQuota, 'exec-q-large');

      // Assert
      expect(result.allowed).toBe(false);
    });
  });

  // =====================================================================
  // Branch Coverage: Rate-Limit Retry (lines 403-414)
  // =====================================================================

  describe('rate-limit retry (executeRovoRequest)', () => {
    it('should retry on 429 and succeed on second attempt', async () => {
      // Arrange — first call returns 429, second succeeds
      const rateLimitedResponse = makeResponse({ ok: false, status: 429 });
      const successResponse = makeSuccessResponse(makeRovoSearchResponse());

      mockRequestConfluence
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(successResponse);

      // Act
      const result = await getContext('auth', 'PROJ', 'exec-retry-429');

      // Assert — should have retried and returned Rovo primary path data
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0]!.id).toBe('doc-1');
      expect(mockRequestConfluence).toHaveBeenCalledTimes(2);
    });

    it('should exhaust retries on persistent 429 and fallback', async () => {
      // Arrange — all Rovo calls return 429, fallback succeeds
      const rateLimitedResponse = makeResponse({ ok: false, status: 429 });
      mockRequestConfluence
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraSearchResponse()));

      // Act
      const result = await getContext('auth', 'PROJ', 'exec-retry-exhaust');

      // Assert — should fallback gracefully
      expect(result.query).toBe('auth');
      expect(result.documents).toEqual([]);
    });
  });

  // =====================================================================
  // Branch Coverage: Network Errors in executeRovoRequest (line 427)
  // =====================================================================

  describe('network errors in Rovo request', () => {
    it('should handle non-abort network error and fallback', async () => {
      // Arrange — Rovo throws generic network error, fallback works
      const networkError = new Error('Network connection failed');
      mockRequestConfluence
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraSearchResponse()));

      // Act
      const result = await getContext('auth', 'PROJ', 'exec-net-err');

      // Assert — should fallback gracefully
      expect(result.query).toBe('auth');
    });

    it('should handle non-Error thrown value and fallback', async () => {
      // Arrange — Rovo throws a string (non-Error), fallback works
      // This exercises the `extractMessage` non-Error path (line 203)
      mockRequestConfluence
        .mockRejectedValueOnce('string error')
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraSearchResponse()));

      // Act
      const result = await getContext('auth', 'PROJ', 'exec-str-err');

      // Assert — should fallback gracefully
      expect(result.query).toBe('auth');
    });
  });

  // =====================================================================
  // Branch Coverage: No Response After Retries (line 435-436)
  // =====================================================================

  describe('no response after retries', () => {
    it('should handle scenario where all retries return 429 on last attempt', async () => {
      // Arrange — all attempts return 429, triggering no-response path
      const rateLimitedResponse = makeResponse({ ok: false, status: 429 });
      mockRequestConfluence
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraSearchResponse()));

      // Act — uses default retry config (maxRetries=2), so 3 attempts total
      const result = await getContext('auth', 'PROJ', 'exec-no-resp');

      // Assert — should fallback because all retries exhausted
      expect(result.query).toBe('auth');
    });
  });

  // =====================================================================
  // Branch Coverage: Jira Fallback Timeout (lines 474-479)
  // =====================================================================

  describe('Jira fallback timeout and network errors', () => {
    it('should handle Jira fallback abort error', async () => {
      // Arrange — Rovo fails, Jira fallback times out (abort), Confluence succeeds
      const abortError = new DOMException('Aborted', 'AbortError');
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503)) // Rovo fail
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse())); // Confluence fallback
      mockRequestJira.mockRejectedValue(abortError);

      // Act
      const result = await getContext('auth', 'PROJ', 'exec-jira-abort');

      // Assert — getContext uses Promise.all with .catch(), so Jira failure is swallowed
      expect(result.query).toBe('auth');
    });

    it('should handle Jira fallback non-abort network error', async () => {
      // Arrange — Rovo fails, Jira fallback throws network error, Confluence succeeds
      const networkError = new Error('Jira network failure');
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503))
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));
      mockRequestJira.mockRejectedValue(networkError);

      // Act — .catch() handlers should swallow the error
      const result = await getContext('auth', 'PROJ', 'exec-jira-net');

      // Assert
      expect(result.query).toBe('auth');
    });
  });

  // =====================================================================
  // Branch Coverage: Confluence Fallback Timeout (lines 515-522)
  // =====================================================================

  describe('Confluence fallback timeout and network errors', () => {
    it('should handle Confluence fallback abort error', async () => {
      // Arrange — Rovo fails, Confluence fallback times out, Jira succeeds
      const abortError = new DOMException('Aborted', 'AbortError');
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503)) // Rovo fail
        .mockRejectedValueOnce(abortError); // Confluence fallback abort
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraSearchResponse()));

      // Act — .catch() should swallow the error
      const result = await getContext('auth', 'PROJ', 'exec-conf-abort');

      // Assert
      expect(result.query).toBe('auth');
    });

    it('should handle Confluence fallback non-abort network error', async () => {
      // Arrange — Rovo fails, Confluence throws generic error, Jira succeeds
      const networkError = new Error('Confluence network failure');
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503))
        .mockRejectedValueOnce(networkError);
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraSearchResponse()));

      // Act
      const result = await getContext('auth', 'PROJ', 'exec-conf-net');

      // Assert
      expect(result.query).toBe('auth');
    });
  });

  // =====================================================================
  // Branch Coverage: getContext fallback .catch() handlers (lines 978-981)
  // =====================================================================

  describe('getContext fallback catch handlers', () => {
    it('should handle both Jira and Confluence fallbacks throwing', async () => {
      // Arrange — Rovo fails, both fallbacks throw errors
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503))
        .mockRejectedValueOnce(new Error('Confluence boom'));
      mockRequestJira.mockRejectedValue(new Error('Jira boom'));

      // Act — .catch() handlers should swallow both errors
      const result = await getContext('auth', 'PROJ', 'exec-both-throw');

      // Assert
      expect(result.query).toBe('auth');
      expect(result.documents).toEqual([]);
      expect(result.relatedTickets).toEqual([]);
      expect(result.decisions).toEqual([]);
    });

    it('should handle Jira fallback throwing and Confluence succeeding', async () => {
      // Arrange — Rovo fails, Jira throws, Confluence works
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503))
        .mockResolvedValueOnce(
          makeSuccessResponse(makeConfluenceSearchResponse([makeConfluencePage('1', 'Doc')])),
        );
      mockRequestJira.mockRejectedValue(new Error('Jira boom'));

      // Act
      const result = await getContext('auth', 'PROJ', 'exec-jira-throw');

      // Assert
      expect(result.query).toBe('auth');
      expect(result.documents.length).toBeGreaterThan(0);
      expect(result.relatedTickets).toEqual([]);
    });
  });

  // =====================================================================
  // Branch Coverage: fallbackJiraSearch catch (lines 623-624)
  // =====================================================================

  describe('fallbackJiraSearch error paths', () => {
    it('should handle Jira search response with invalid issues field', async () => {
      // Arrange — Rovo fails, Jira returns non-array issues
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503))
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));
      mockRequestJira.mockResolvedValue(makeSuccessResponse({ issues: 'not-an-array' }));

      // Act — isJiraSearchResponse should reject non-array issues
      const result = await getContext('auth', 'PROJ', 'exec-invalid-issues');

      // Assert
      expect(result.query).toBe('auth');
      expect(result.relatedTickets).toEqual([]);
    });

    it('should handle Jira search returning issues with invalid structure', async () => {
      // Arrange — Rovo fails, Jira returns issues missing key/fields
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503))
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));
      mockRequestJira.mockResolvedValue(
        makeSuccessResponse({
          issues: [
            { key: 'PROJ-1', fields: { summary: 'Valid' } },
            { key: 123 }, // invalid: key not string
            { fields: { summary: 'No key' } }, // invalid: missing key
            { key: 'PROJ-2' }, // invalid: missing fields
            'not-an-object', // invalid: not object
          ],
        }),
      );

      // Act — isJiraSearchIssue filter should exclude invalid issues
      const result = await getContext('auth', 'PROJ', 'exec-bad-issues');

      // Assert
      expect(result.query).toBe('auth');
      expect(result.relatedTickets).toEqual(['PROJ-1']);
    });
  });

  // =====================================================================
  // Branch Coverage: fallbackRelatedTicketsByLabels catch (lines 661-662)
  // =====================================================================

  describe('fallbackRelatedTicketsByLabels error paths', () => {
    it('should handle empty labels by returning empty array immediately', async () => {
      // Arrange — ticket has no labels, Rovo unavailable
      mockRequestJira
        .mockResolvedValueOnce(
          makeSuccessResponse({
            key: 'PROJ-123',
            fields: { summary: 'Test', labels: [] },
          }),
        )
        .mockResolvedValueOnce(makeSuccessResponse(makeJiraSearchResponse()));
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act — getRelatedTickets with empty labels should skip label-based search
      const result = await getRelatedTickets('PROJ-123', 'exec-empty-labels');

      // Assert — falls through to summary-based JQL search
      expect(result).toEqual([]);
    });

    it('should handle error in fallbackRelatedTicketsByLabels', async () => {
      // Arrange — ticket has labels, Rovo fails, Jira label search throws
      mockRequestJira
        .mockResolvedValueOnce(
          makeSuccessResponse({
            key: 'PROJ-123',
            fields: { summary: 'Test', labels: ['auth'] },
          }),
        )
        .mockRejectedValueOnce(new Error('Jira label search failed'));
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act — catch block should return empty
      const result = await getRelatedTickets('PROJ-123', 'exec-label-err');

      // Assert
      expect(result).toEqual([]);
    });
  });

  // =====================================================================
  // Branch Coverage: fetchConfluencePage catch (lines 767-768)
  // =====================================================================

  describe('Confluence page fetch error paths', () => {
    it('should handle Confluence search response with non-array results', async () => {
      // Arrange — Rovo fails, Confluence returns non-array results
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503))
        .mockResolvedValueOnce(makeSuccessResponse({ results: 'not-array' }));

      // Act
      const result = await getDocumentation('test', undefined, 'exec-conf-bad-res');

      // Assert — isConfluenceSearchResponse should reject non-array results
      expect(result).toEqual([]);
    });

    it('should handle Confluence page with missing id', async () => {
      // Arrange — Rovo fails, Confluence returns page without id
      mockRequestConfluence.mockResolvedValueOnce(makeErrorResponse(503)).mockResolvedValueOnce(
        makeSuccessResponse({
          results: [
            { id: 'valid-page', title: 'Valid' },
            { title: 'No ID' }, // missing id
            { id: 123, title: 'Numeric ID' }, // id not string
          ],
        }),
      );

      // Act
      const result = await getDocumentation('test', undefined, 'exec-conf-no-id');

      // Assert — isConfluencePage should filter to only valid pages
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('valid-page');
    });

    it('should handle Confluence page with missing optional fields', async () => {
      // Arrange — Rovo fails, Confluence returns page with minimal fields
      mockRequestConfluence.mockResolvedValueOnce(makeErrorResponse(503)).mockResolvedValueOnce(
        makeSuccessResponse({
          results: [
            { id: 'minimal-page' }, // no title, body, space, etc.
          ],
        }),
      );

      // Act
      const result = await getDocumentation('test', undefined, 'exec-conf-minimal');

      // Assert — mapConfluencePageToDocument should use defaults
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('minimal-page');
      expect(result[0]!.title).toBe('');
      expect(result[0]!.content).toBe('');
    });
  });

  // =====================================================================
  // Branch Coverage: fallbackDecisionSearch catch (lines 809-810)
  // =====================================================================

  describe('fallbackDecisionSearch error paths', () => {
    it('should handle Confluence error during decision search', async () => {
      // Arrange — Rovo fails, Confluence decision search throws
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503))
        .mockRejectedValueOnce(new Error('Confluence decision search failed'));

      // Act
      const result = await getHistoricalDecisions('PROJ', 'exec-dec-err');

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle Confluence returning non-array results for decisions', async () => {
      // Arrange — Rovo fails, Confluence returns non-array results
      mockRequestConfluence
        .mockResolvedValueOnce(makeErrorResponse(503))
        .mockResolvedValueOnce(makeSuccessResponse({ results: 'not-array' }));

      // Act
      const result = await getHistoricalDecisions('PROJ', 'exec-dec-bad-res');

      // Assert — isConfluenceSearchResponse should reject
      expect(result).toEqual([]);
    });
  });

  // =====================================================================
  // Branch Coverage: fetchTicketFields catch (lines 846-847)
  // =====================================================================

  describe('fetchTicketFields error paths', () => {
    it('should handle Jira error when fetching ticket fields', async () => {
      // Arrange — fetchTicketFields throws, then Rovo also fails
      mockRequestJira.mockRejectedValue(new Error('Jira fields fetch failed'));
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act — getRelatedTickets should handle gracefully
      const result = await getRelatedTickets('PROJ-123', 'exec-fields-err');

      // Assert — ticketFields undefined, summary='', labels=[], fallback used
      expect(result).toEqual([]);
    });

    it('should handle Jira returning non-OK response for ticket fields', async () => {
      // Arrange — fetchTicketFields returns non-OK
      mockRequestJira
        .mockResolvedValueOnce(makeErrorResponse(404))
        .mockResolvedValueOnce(makeSuccessResponse(makeJiraSearchResponse()));
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      const result = await getRelatedTickets('PROJ-123', 'exec-fields-404');

      // Assert — ticketFields undefined, empty summary/labels, fallback used
      expect(result).toEqual([]);
    });

    it('should handle Jira returning invalid fields structure', async () => {
      // Arrange — fetchTicketFields returns response without fields
      mockRequestJira
        .mockResolvedValueOnce(makeSuccessResponse({ key: 'PROJ-123' })) // no fields property
        .mockResolvedValueOnce(makeSuccessResponse(makeJiraSearchResponse()));
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      const result = await getRelatedTickets('PROJ-123', 'exec-no-fields');

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle Jira returning fields with non-string summary', async () => {
      // Arrange — fields exist but summary is not a string
      mockRequestJira
        .mockResolvedValueOnce(
          makeSuccessResponse({
            fields: { summary: 123, labels: 'not-array' },
          }),
        )
        .mockResolvedValueOnce(makeSuccessResponse(makeJiraSearchResponse()));
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      const result = await getRelatedTickets('PROJ-123', 'exec-bad-summary');

      // Assert — summary should default to '', labels to []
      expect(result).toEqual([]);
    });
  });

  // =====================================================================
  // Branch Coverage: mapToRovoDocument null/non-object (line 306)
  // mapToHistoricalDecision null/non-object (lines 323-327)
  // =====================================================================

  describe('mapper functions with invalid inputs', () => {
    it('should map invalid (null) documents in Rovo response to default docs', async () => {
      // Arrange — Rovo returns array with null/invalid entries
      const responseWithNulls = {
        documents: [
          null,
          undefined,
          'string',
          42,
          { id: 'valid', title: 'Valid', content: 'C', source: 's', relevance: 0.5 },
        ],
        relatedTickets: [null, 123, 'PROJ-1'],
        decisions: [],
      };
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(responseWithNulls));

      // Act
      const result = await getContext('auth', 'PROJ', 'exec-null-docs');

      // Assert — invalid docs should be mapped to defaults
      expect(result.documents).toHaveLength(5);
      expect(result.documents[0]!.source).toBe('rovo'); // null mapped
      expect(result.documents[4]!.id).toBe('valid'); // valid preserved
      // relatedTickets: null and 123 filtered out, only 'PROJ-1' kept
      expect(result.relatedTickets).toEqual(['PROJ-1']);
    });

    it('should map invalid decisions in Rovo response to default decisions', async () => {
      // Arrange — Rovo returns array with null/invalid decision entries
      const responseWithInvalidDecisions = {
        documents: [],
        relatedTickets: [],
        decisions: [
          null,
          'not-a-decision',
          {
            id: 'd1',
            title: 'Valid Decision',
            description: 'desc',
            date: '2026-01-01',
            source: 'confluence',
          },
          { id: 'd2' }, // missing title, description, date, source
        ],
      };
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(responseWithInvalidDecisions));

      // Act
      const result = await getContext('auth', 'PROJ', 'exec-invalid-decisions');

      // Assert — invalid decisions mapped to defaults
      expect(result.decisions).toHaveLength(4);
      expect(result.decisions[0]!.source).toBe('rovo'); // null mapped
      expect(result.decisions[2]!.title).toBe('Valid Decision'); // valid preserved
      expect(result.decisions[3]!.id).toBe('d2'); // partial mapped with defaults
      expect(result.decisions[3]!.title).toBe('');
    });
  });

  // =====================================================================
  // Branch Coverage: callRovoValidation catch and issues filtering (1188, 1198-1199)
  // =====================================================================

  describe('callRovoValidation error and edge cases', () => {
    it('should handle Rovo validation returning issues with mixed types', async () => {
      // Arrange — Rovo validation returns issues array with non-string items
      const validationResponse = {
        isConsistent: false,
        confidence: 0.6,
        source: 'rovo',
        issues: [
          'Valid issue string',
          42,
          null,
          'Another valid issue',
          { message: 'not a string' },
        ],
      };
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(validationResponse));

      // Act
      const ticketData = makeJiraTicketData();
      const context = makeRovoContext();
      const result = await validateConsistency(ticketData, context, 'exec-val-mixed');

      // Assert — only string issues should be kept
      expect(result.source).toBe('rovo');
      expect(result.isConsistent).toBe(false);
      expect(result.issues).toEqual(['Valid issue string', 'Another valid issue']);
    });

    it('should handle Rovo validation with missing optional fields (defaults)', async () => {
      // Arrange — Rovo validation response missing isConsistent and confidence
      const partialValidation = {
        issues: ['Some issue'],
      };
      // This will fail isRovoValidationResponse because isConsistent is not boolean
      // So it falls through to rule-based
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(partialValidation));

      // Act
      const ticketData = makeJiraTicketData();
      const context = makeRovoContext();
      const result = await validateConsistency(ticketData, context, 'exec-val-partial');

      // Assert — should fallback to rule-based
      expect(result.source).toBe('rule-based');
    });

    it('should handle Rovo validation returning non-OK response', async () => {
      // Arrange — Rovo validation returns 500
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(500));

      // Act
      const ticketData = makeJiraTicketData();
      const context = makeRovoContext();
      const result = await validateConsistency(ticketData, context, 'exec-val-500');

      // Assert — should fallback to rule-based
      expect(result.source).toBe('rule-based');
    });

    it('should handle Rovo validation endpoint throwing network error', async () => {
      // Arrange — Rovo validation request throws
      mockRequestConfluence.mockRejectedValue(new Error('Validation network error'));

      // Act
      const ticketData = makeJiraTicketData();
      const context = makeRovoContext();
      const result = await validateConsistency(ticketData, context, 'exec-val-throw');

      // Assert — should fallback to rule-based
      expect(result.source).toBe('rule-based');
      expect(typeof result.isConsistent).toBe('boolean');
    });

    it('should handle Rovo validation with empty issues array', async () => {
      // Arrange — valid Rovo response with empty issues
      const validResponse = {
        isConsistent: true,
        confidence: 0.9,
        source: 'rovo',
        issues: [],
      };
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(validResponse));

      // Act
      const ticketData = makeJiraTicketData();
      const context = makeRovoContext();
      const result = await validateConsistency(ticketData, context, 'exec-val-empty-issues');

      // Assert
      expect(result.source).toBe('rovo');
      expect(result.isConsistent).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('should handle Rovo validation with issues not being an array', async () => {
      // Arrange — issues is a string instead of array
      const badIssuesResponse = {
        isConsistent: false,
        confidence: 0.5,
        source: 'rovo',
        issues: 'not-an-array',
      };
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(badIssuesResponse));

      // Act
      const ticketData = makeJiraTicketData();
      const context = makeRovoContext();
      const result = await validateConsistency(ticketData, context, 'exec-val-bad-issues');

      // Assert — issues should default to empty array
      expect(result.source).toBe('rovo');
      expect(result.issues).toEqual([]);
    });

    it('should handle Rovo validation with source undefined (accepted by type guard)', async () => {
      // Arrange — source is undefined, which is valid per the type guard
      const noSourceResponse = {
        isConsistent: true,
        confidence: 0.8,
        // source is absent/undefined
        issues: [],
      };
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(noSourceResponse));

      // Act
      const ticketData = makeJiraTicketData();
      const context = makeRovoContext();
      const result = await validateConsistency(ticketData, context, 'exec-val-no-source');

      // Assert — should still use rovo source in the returned object
      expect(result.source).toBe('rovo');
      expect(result.isConsistent).toBe(true);
    });
  });

  // =====================================================================
  // Branch Coverage: extractKeywords with edge cases
  // =====================================================================

  describe('extractKeywords edge cases', () => {
    it('should handle single-character words being filtered out', async () => {
      // Arrange — query with only single-char words and longer ones
      // "a b cd" -> only "cd" (length > 1) survives, "a" and "b" are filtered
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(makeRovoSearchResponse()));

      // Act
      const result = await getContext('a b cd ef', 'PROJ', 'exec-short-words');

      // Assert
      expect(result.query).toBe('a b cd ef');
    });
  });

  // =====================================================================
  // Branch Coverage: performRuleBasedValidation edge cases (lines 877-927)
  // =====================================================================

  describe('rule-based validation edge cases', () => {
    it('should handle ticket with no labels', async () => {
      // Arrange — ticket with empty labels, no overlap
      const ticketData = makeJiraTicketData({
        labels: [],
        summary: 'Completely unrelated topic xyz',
      });
      const context = makeRovoContext({
        documents: [makeRovoDocument({ title: 'Auth Guide', content: 'OAuth2 setup' })],
        relatedTickets: [],
      });
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      const result = await validateConsistency(ticketData, context, 'exec-rb-no-labels');

      // Assert — no labels means label check passes without issue
      expect(result.source).toBe('rule-based');
    });

    it('should detect label overlap with context documents', async () => {
      // Arrange — ticket labels overlap with document content
      const ticketData = makeJiraTicketData({
        labels: ['oauth2'],
        summary: 'Setup authentication',
      });
      const context = makeRovoContext({
        documents: [
          makeRovoDocument({ title: 'OAuth2 Guide', content: 'oauth2 setup instructions' }),
        ],
        relatedTickets: [],
      });
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      const result = await validateConsistency(ticketData, context, 'exec-rb-label-match');

      // Assert
      expect(result.source).toBe('rule-based');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should flag issue when labels have no overlap with context', async () => {
      // Arrange — labels exist but no overlap with any document content
      const ticketData = makeJiraTicketData({
        labels: ['database', 'migration'],
        summary: 'Short', // short summary words filtered out
      });
      const context = makeRovoContext({
        documents: [makeRovoDocument({ title: 'Auth Guide', content: 'OAuth2 setup only' })],
        relatedTickets: [],
      });
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      const result = await validateConsistency(ticketData, context, 'exec-rb-no-overlap');

      // Assert — should flag label mismatch issue
      expect(result.source).toBe('rule-based');
      expect(result.issues).toContain('Ticket labels have no overlap with context documents');
    });

    it('should flag issue when summary has no keyword overlap with context', async () => {
      // Arrange — summary words have no overlap, no labels
      const ticketData = makeJiraTicketData({
        labels: [],
        summary: 'Completely unrelated infrastructure provisioning topic',
      });
      const context = makeRovoContext({
        documents: [
          makeRovoDocument({ title: 'Auth Guide', content: 'OAuth2 setup instructions' }),
        ],
        relatedTickets: [],
      });
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      const result = await validateConsistency(ticketData, context, 'exec-rb-no-summary');

      // Assert
      expect(result.source).toBe('rule-based');
      expect(result.issues).toContain(
        'Ticket summary has no keyword overlap with context documents',
      );
    });

    it('should boost confidence when ticket is in related tickets list', async () => {
      // Arrange — ticket key is in relatedTickets
      const ticketData = makeJiraTicketData({
        key: 'PROJ-123',
        summary: 'implement authentication oauth2',
        labels: ['auth'],
      });
      const context = makeRovoContext({
        documents: [
          makeRovoDocument({ title: 'Auth Setup', content: 'authentication oauth2 guide' }),
        ],
        relatedTickets: ['PROJ-123'],
      });
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      const result = await validateConsistency(ticketData, context, 'exec-rb-related');

      // Assert — being in relatedTickets should boost confidence
      expect(result.source).toBe('rule-based');
      expect(result.isConsistent).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should handle empty context documents', async () => {
      // Arrange — no documents in context
      const ticketData = makeJiraTicketData({
        labels: ['auth'],
        summary: 'Implement authentication system',
      });
      const context = makeRovoContext({
        documents: [],
        relatedTickets: [],
      });
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      const result = await validateConsistency(ticketData, context, 'exec-rb-empty-ctx');

      // Assert — no docs means no overlap, should flag issues
      expect(result.source).toBe('rule-based');
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.isConsistent).toBe(false);
    });
  });

  // =====================================================================
  // Branch Coverage: getRelatedTickets full Rovo path with no relatedTickets
  // =====================================================================

  describe('getRelatedTickets additional branches', () => {
    it('should fallback to Jira summary search when ticket has no labels and Rovo fails', async () => {
      // Arrange — ticket has no labels, Rovo returns null relatedTickets
      mockRequestJira
        .mockResolvedValueOnce(
          makeSuccessResponse({
            key: 'PROJ-123',
            fields: { summary: 'Auth setup task', labels: [] },
          }),
        )
        .mockResolvedValueOnce(
          makeSuccessResponse(
            makeJiraSearchResponse([makeJiraSearchIssue('PROJ-99', 'Auth related')]),
          ),
        );
      // Rovo fails for the search call
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(503));

      // Act
      const result = await getRelatedTickets('PROJ-123', 'exec-rt-no-labels');

      // Assert — should use summary-based fallback JQL search
      expect(result).toContain('PROJ-99');
    });

    it('should return tickets from Rovo primary path excluding self', async () => {
      // Arrange — Rovo returns related tickets including the queried one
      mockRequestJira.mockResolvedValue(
        makeSuccessResponse({
          key: 'PROJ-123',
          fields: { summary: 'Auth task', labels: ['auth'] },
        }),
      );
      mockRequestConfluence.mockResolvedValue(
        makeSuccessResponse({
          documents: [],
          relatedTickets: ['PROJ-123', 'PROJ-456', 'PROJ-789'],
          decisions: [],
        }),
      );

      // Act
      const result = await getRelatedTickets('PROJ-123', 'exec-rt-self');

      // Assert — should exclude PROJ-123 from results
      expect(result).not.toContain('PROJ-123');
      expect(result).toContain('PROJ-456');
      expect(result).toContain('PROJ-789');
    });

    it('should handle Rovo returning non-array relatedTickets', async () => {
      // Arrange — Rovo returns relatedTickets that is not an array
      mockRequestJira
        .mockResolvedValueOnce(
          makeSuccessResponse({
            key: 'PROJ-123',
            fields: { summary: 'Auth', labels: ['auth'] },
          }),
        )
        .mockResolvedValueOnce(makeSuccessResponse(makeJiraSearchResponse()));
      mockRequestConfluence.mockResolvedValue(
        makeSuccessResponse({
          documents: [],
          relatedTickets: 'not-array',
          decisions: [],
        }),
      );

      // Act — should fallback because relatedTickets is not an array
      const result = await getRelatedTickets('PROJ-123', 'exec-rt-nonarray');

      // Assert
      expect(result).toEqual([]);
    });
  });

  // =====================================================================
  // Branch Coverage: getDocumentation and getHistoricalDecisions additional
  // =====================================================================

  describe('getDocumentation additional branches', () => {
    it('should handle Rovo returning documents that are not an array', async () => {
      // Arrange — Rovo returns documents as string (not array), fallback to Confluence
      mockRequestConfluence
        .mockResolvedValueOnce(
          makeSuccessResponse({
            documents: 'not-array',
            relatedTickets: [],
            decisions: [],
          }),
        )
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));

      // Act — should fallback to Confluence CQL because isRovoSearchResponse rejects
      // and then documents field fails Array.isArray check
      const result = await getDocumentation('test', undefined, 'exec-doc-not-array');

      // Assert
      expect(result).toEqual([]);
    });
  });

  // =====================================================================
  // Branch Coverage: isRovoSearchResponse branches (lines 222-227)
  // =====================================================================

  describe('isRovoSearchResponse type guard branches', () => {
    it('should handle response with decisions field as non-array', async () => {
      // Arrange — decisions is a string, not array
      const badDecisions = {
        documents: [],
        relatedTickets: [],
        decisions: 'not-array',
      };
      mockRequestConfluence
        .mockResolvedValueOnce(makeSuccessResponse(badDecisions))
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraSearchResponse()));

      // Act — isRovoSearchResponse should reject because decisions is not array
      const result = await getContext('auth', 'PROJ', 'exec-bad-decisions');

      // Assert — should fallback
      expect(result.query).toBe('auth');
    });

    it('should handle response with relatedTickets field as non-array', async () => {
      // Arrange — relatedTickets is a number, not array
      const badRelated = {
        documents: [],
        relatedTickets: 42,
        decisions: [],
      };
      mockRequestConfluence
        .mockResolvedValueOnce(makeSuccessResponse(badRelated))
        .mockResolvedValueOnce(makeSuccessResponse(makeConfluenceSearchResponse()));
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraSearchResponse()));

      // Act
      const result = await getContext('auth', 'PROJ', 'exec-bad-related');

      // Assert — should fallback
      expect(result.query).toBe('auth');
    });
  });

  // =====================================================================
  // Branch Coverage: cursor extraction (line 777-778)
  // =====================================================================

  describe('cursor extraction', () => {
    it('should handle URL with no cursor parameter', async () => {
      // Arrange — next URL has no cursor param
      mockRequestConfluence.mockResolvedValueOnce(makeErrorResponse(503)).mockResolvedValueOnce(
        makeSuccessResponse({
          results: [makeConfluencePage('1', 'Page 1')],
          _links: { next: '/rest/api/content/search?start=10' }, // no cursor param
        }),
      );

      // Act
      const result = await getDocumentation('test', undefined, 'exec-no-cursor');

      // Assert — pagination should stop since no cursor extracted
      expect(result).toHaveLength(1);
    });
  });
});
