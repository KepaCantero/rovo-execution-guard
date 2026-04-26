/**
 * Forge API Mock Helpers
 *
 * Typed mock factories for @forge/api functions used by adapter tests.
 * Since Forge runtime functions (requestJira, requestConfluence, forgeFetch)
 * go through the Forge platform proxy, nock cannot intercept them.
 * Instead, we use jest.mock('@forge/api') with these typed helpers.
 *
 * [TEST-QA-202] Exception: @forge/api is an external SDK, not an internal dep.
 * [TEST-QA-204] afterEach(() => { jest.clearAllMocks(); }) is mandatory.
 * [ARCH-SOLID-202] Zero any — all mocks are fully typed.
 */

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/**
 * Mimics the Pick<Response, ...> shape that @forge/api declares as APIResponse.
 * [ARCH-SOLID-203] Aligned with @forge/api's actual type declaration.
 */
export interface MockAPIResponse {
  readonly json: () => Promise<unknown>;
  readonly text: () => Promise<string>;
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly headers: {
    get: (name: string) => string | null;
    has: (name: string) => boolean;
    forEach: (callback: (value: string, name: string) => void) => void;
  };
}

/** Headers map for constructing mock response headers. */
export type MockHeaders = Readonly<Record<string, string>>;

/** Options for creating a mock API response. */
export interface MockResponseOptions {
  readonly status?: number;
  readonly statusText?: string;
  readonly body?: unknown;
  readonly headers?: MockHeaders;
}

/** Route type matching @forge/api's Route interface. */
export interface MockRoute {
  readonly value: string;
}

/** ForgeRequestOptions type matching @forge/api's FetchOptions (RequestInit). */
export type ForgeRequestOptions = {
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
  readonly signal?: AbortSignal;
};

// ═══════════════════════════════════════════
// MOCK RESPONSE FACTORY
// ═══════════════════════════════════════════

/**
 * Creates a typed MockAPIResponse.
 *
 * [TEST-QA-058] Fixtures must use realistic response shapes.
 * [ARCH-SOLID-202] No any — uses unknown with type narrowing.
 */
export function createMockResponse(options: MockResponseOptions = {}): MockAPIResponse {
  const { status = 200, statusText = 'OK', body = null, headers = {} } = options;

  const ok = status >= 200 && status < 300;

  return {
    json: async (): Promise<unknown> => body,
    text: async (): Promise<string> => (typeof body === 'string' ? body : JSON.stringify(body)),
    arrayBuffer: async (): Promise<ArrayBuffer> => {
      const encoder = new TextEncoder();
      return encoder.encode(typeof body === 'string' ? body : JSON.stringify(body)).buffer;
    },
    ok,
    status,
    statusText,
    headers: {
      get: (name: string): string | null => headers[name] ?? null,
      has: (name: string): boolean => name in headers,
      forEach: (callback: (value: string, name: string) => void): void => {
        for (const [key, value] of Object.entries(headers)) {
          callback(value, key);
        }
      },
    },
  };
}

// ═══════════════════════════════════════════
// CONVENIENCE RESPONSE BUILDERS
// ═══════════════════════════════════════════

/** Creates a 200 OK response with a JSON body. */
export function okResponse(body: unknown, headers?: MockHeaders): MockAPIResponse {
  return createMockResponse({ status: 200, statusText: 'OK', body, headers });
}

/** Creates a 201 Created response. */
export function createdResponse(body: unknown, headers?: MockHeaders): MockAPIResponse {
  return createMockResponse({ status: 201, statusText: 'Created', body, headers });
}

/** Creates a 204 No Content response. */
export function noContentResponse(): MockAPIResponse {
  return createMockResponse({ status: 204, statusText: 'No Content', body: null });
}

/** Creates a 404 Not Found response. */
export function notFoundResponse(message = 'Not Found'): MockAPIResponse {
  return createMockResponse({
    status: 404,
    statusText: 'Not Found',
    body: { errorMessages: [message] },
  });
}

/** Creates a 429 Rate Limited response with optional Retry-After header. */
export function rateLimitedResponse(retryAfter?: number): MockAPIResponse {
  return createMockResponse({
    status: 429,
    statusText: 'Too Many Requests',
    body: { errorMessages: ['Rate limit exceeded'] },
    headers: retryAfter !== undefined ? { 'Retry-After': String(retryAfter) } : {},
  });
}

/** Creates a 500 Internal Server Error response. */
export function serverErrorResponse(message = 'Internal Server Error'): MockAPIResponse {
  return createMockResponse({
    status: 500,
    statusText: 'Internal Server Error',
    body: { errorMessages: [message] },
  });
}

/** Creates a 403 Forbidden response. */
export function forbiddenResponse(message = 'Forbidden'): MockAPIResponse {
  return createMockResponse({
    status: 403,
    statusText: 'Forbidden',
    body: { errorMessages: [message] },
  });
}

// ═══════════════════════════════════════════
// MOCK FACTORY FUNCTIONS
// ═══════════════════════════════════════════

/**
 * Creates a mock requestJira function.
 *
 * Returns a jest.Mock whose implementation resolves with the provided response.
 * Can be configured to return different responses per call by chaining
 * mockResolvedValueOnce / mockRejectedValueOnce.
 */
export function createMockRequestJira(
  defaultResponse: MockAPIResponse = okResponse({}),
): jest.Mock<Promise<MockAPIResponse>, [MockRoute | string, ForgeRequestOptions?]> {
  return jest.fn().mockResolvedValue(defaultResponse);
}

/**
 * Creates a mock requestConfluence function.
 */
export function createMockRequestConfluence(
  defaultResponse: MockAPIResponse = okResponse({}),
): jest.Mock<Promise<MockAPIResponse>, [MockRoute | string, ForgeRequestOptions?]> {
  return jest.fn().mockResolvedValue(defaultResponse);
}

/**
 * Creates a mock forgeFetch function.
 * GitHub adapter imports { fetch as forgeFetch } from '@forge/api'.
 */
export function createMockForgeFetch(
  defaultResponse: MockAPIResponse = okResponse({}),
): jest.Mock<Promise<MockAPIResponse>, [MockRoute | string, ForgeRequestOptions?]> {
  return jest.fn().mockResolvedValue(defaultResponse);
}

/**
 * Creates a mock route function that matches @forge/api's route tag template.
 * Returns a MockRoute with the interpolated value.
 *
 * Usage: mockRoute`/rest/api/2/issue/${issueKey}` → { value: '/rest/api/2/issue/PROJ-123' }
 */
export function createMockRoute(): (
  template: TemplateStringsArray,
  ...params: (string | number | MockRoute)[]
) => MockRoute {
  return (
    template: TemplateStringsArray,
    ...params: (string | number | MockRoute)[]
  ): MockRoute => {
    let value = '';
    for (let i = 0; i < template.length; i++) {
      value += template[i];
      if (i < params.length) {
        const param = params[i];
        value += typeof param === 'object' && 'value' in param ? param.value : String(param);
      }
    }
    return { value };
  };
}

// ═══════════════════════════════════════════
// @forge/api MODULE MOCK SETUP
// ═══════════════════════════════════════════

/**
 * Module-level mock map for @forge/api.
 *
 * Usage in test files:
 * ```typescript
 * import { createForgeApiMock } from '../../mocks/forge-api';
 *
 * const { mockRequestJira, mockRoute } = createForgeApiMock();
 *
 * jest.mock('@forge/api', () => ({
 *   requestJira: mockRequestJira,
 *   route: mockRoute,
 *   ...createForgeApiMock().getModuleMock(),
 * }));
 * ```
 */

export interface ForgeApiMockSet {
  readonly requestJira: jest.Mock<
    Promise<MockAPIResponse>,
    [MockRoute | string, ForgeRequestOptions?]
  >;
  readonly requestConfluence: jest.Mock<
    Promise<MockAPIResponse>,
    [MockRoute | string, ForgeRequestOptions?]
  >;
  readonly fetch: jest.Mock<Promise<MockAPIResponse>, [MockRoute | string, ForgeRequestOptions?]>;
  readonly route: (
    template: TemplateStringsArray,
    ...params: (string | number | MockRoute)[]
  ) => MockRoute;
  readonly defaultResponse: MockAPIResponse;
}

/**
 * Creates a complete set of @forge/api mocks.
 *
 * Returns the mock functions AND a getModuleMock() helper that produces
 * the object suitable for jest.mock('@forge/api', () => ...).
 *
 * Each mock function is a jest.Mock that can be further configured:
 * - mockResolvedValueOnce() for sequential responses
 * - mockRejectedValueOnce() for error simulation
 * - mockImplementation() for custom behavior
 */
export function createForgeApiMockSet(defaultResponse?: MockAPIResponse): ForgeApiMockSet {
  const response = defaultResponse ?? okResponse({});
  const mockRequestJira = createMockRequestJira(response);
  const mockRequestConfluence = createMockRequestConfluence(response);
  const mockFetch = createMockForgeFetch(response);
  const mockRoute = createMockRoute();

  return {
    requestJira: mockRequestJira,
    requestConfluence: mockRequestConfluence,
    fetch: mockFetch,
    route: mockRoute,
    defaultResponse: response,
  };
}

/**
 * Convenience: creates the full mock module object for jest.mock('@forge/api').
 *
 * Note: jest.mock() must be called at module scope (not inside a function),
 * so use this pattern in test files:
 *
 * ```typescript
 * // At the top of the test file, outside describe():
 * const mocks = createForgeApiMockSet();
 * jest.mock('@forge/api', () => ({
 *   requestJira: mocks.requestJira,
 *   requestConfluence: mocks.requestConfluence,
 *   fetch: mocks.fetch,
 *   route: mocks.route,
 * }));
 * ```
 */
export function createForgeApiModuleMock(
  defaultResponse?: MockAPIResponse,
): Record<string, unknown> {
  const set = createForgeApiMockSet(defaultResponse);
  return {
    requestJira: set.requestJira,
    requestConfluence: set.requestConfluence,
    fetch: set.fetch,
    route: set.route,
    // Re-export the named exports that adapters use
    APIResponse: undefined, // type-only export, not needed at runtime
    FetchOptions: undefined, // type-only export, not needed at runtime
  };
}
