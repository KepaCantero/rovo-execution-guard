/**
 * Tests for Forge API Mock Helpers
 *
 * Validates that the mock factories produce correctly shaped responses
 * and mock functions that behave as expected.
 *
 * [TEST-QA-201] AAA structure in all tests.
 * [TEST-QA-204] afterEach cleanup.
 * [TEST-QA-0954] async/await only.
 */

import {
  createMockResponse,
  okResponse,
  createdResponse,
  noContentResponse,
  notFoundResponse,
  rateLimitedResponse,
  serverErrorResponse,
  forbiddenResponse,
  createMockRequestJira,
  createMockRequestConfluence,
  createMockForgeFetch,
  createMockRoute,
  createForgeApiMockSet,
  createForgeApiModuleMock,
  type MockAPIResponse,
  type MockRoute,
} from './forge-api';

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('forge-api mock helpers', () => {
  // ─── Setup & Teardown ─────────────────

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── createMockResponse() ───────────────

  describe('createMockResponse()', () => {
    it('should return correct defaults when no options provided (AC-01)', () => {
      // Act
      const response = createMockResponse();

      // Assert
      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(response.ok).toBe(true);
    });

    it('should return JSON body via json() (AC-01)', async () => {
      // Arrange
      const body = { key: 'PROJ-123', fields: { summary: 'Test issue' } };

      // Act
      const response = createMockResponse({ body });

      // Assert
      await expect(response.json()).resolves.toEqual(body);
    });

    it('should return string body via text() when body is a string (AC-01)', async () => {
      // Arrange
      const body = 'plain text response';

      // Act
      const response = createMockResponse({ body });

      // Assert
      await expect(response.text()).resolves.toBe('plain text response');
    });

    it('should return JSON string via text() when body is an object (AC-01)', async () => {
      // Arrange
      const body = { error: 'test' };

      // Act
      const response = createMockResponse({ body });

      // Assert
      await expect(response.text()).resolves.toBe(JSON.stringify(body));
    });

    it('should return ArrayBuffer via arrayBuffer() (AC-01)', async () => {
      // Arrange
      const body = 'test data';

      // Act
      const response = createMockResponse({ body });
      const buffer = await response.arrayBuffer();

      // Assert
      expect(buffer).toBeInstanceOf(ArrayBuffer);
    });

    it('should set ok to false for error status codes (AC-01)', () => {
      // Act
      const response = createMockResponse({ status: 500 });

      // Assert
      expect(response.ok).toBe(false);
    });

    it('should set ok to true for 2xx status codes (AC-01)', () => {
      // Act
      const response201 = createMockResponse({ status: 201 });
      const response204 = createMockResponse({ status: 204 });

      // Assert
      expect(response201.ok).toBe(true);
      expect(response204.ok).toBe(true);
    });

    it('should support custom headers via get/has/forEach (AC-01)', () => {
      // Arrange
      const headers = { 'Content-Type': 'application/json', 'X-Custom': 'value' };

      // Act
      const response = createMockResponse({ headers });

      // Assert
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Custom')).toBe('value');
      expect(response.headers.get('Missing')).toBeNull();
      expect(response.headers.has('Content-Type')).toBe(true);
      expect(response.headers.has('Missing')).toBe(false);
    });

    it('should iterate headers via forEach (AC-01)', () => {
      // Arrange
      const headers = { 'X-A': '1', 'X-B': '2' };
      const response = createMockResponse({ headers });
      const collected: Record<string, string> = {};

      // Act
      response.headers.forEach((value, name) => {
        collected[name] = value;
      });

      // Assert
      expect(collected).toEqual({ 'X-A': '1', 'X-B': '2' });
    });
  });

  // ─── Convenience Response Builders ─────

  describe('convenience response builders', () => {
    it('okResponse creates 200 response with body (AC-02)', async () => {
      // Arrange
      const body = { issues: [] };

      // Act
      const response = okResponse(body);

      // Assert
      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);
      expect(response.statusText).toBe('OK');
      await expect(response.json()).resolves.toEqual(body);
    });

    it('okResponse passes through headers (AC-02)', () => {
      // Act
      const response = okResponse({}, { 'X-Page': '1' });

      // Assert
      expect(response.headers.get('X-Page')).toBe('1');
    });

    it('createdResponse creates 201 response (AC-02)', () => {
      // Act
      const response = createdResponse({ id: '12345' });

      // Assert
      expect(response.status).toBe(201);
      expect(response.ok).toBe(true);
      expect(response.statusText).toBe('Created');
    });

    it('noContentResponse creates 204 response (AC-02)', async () => {
      // Act
      const response = noContentResponse();

      // Assert
      expect(response.status).toBe(204);
      expect(response.ok).toBe(true);
      expect(response.statusText).toBe('No Content');
      await expect(response.json()).resolves.toBeNull();
    });

    it('notFoundResponse creates 404 response with default message (AC-02)', async () => {
      // Act
      const response = notFoundResponse();

      // Assert
      expect(response.status).toBe(404);
      expect(response.ok).toBe(false);
      expect(response.statusText).toBe('Not Found');
      const body = (await response.json()) as { errorMessages: string[] };
      expect(body.errorMessages).toContain('Not Found');
    });

    it('notFoundResponse uses custom message (AC-02)', async () => {
      // Act
      const response = notFoundResponse('Issue does not exist');

      // Assert
      const body = (await response.json()) as { errorMessages: string[] };
      expect(body.errorMessages).toContain('Issue does not exist');
    });

    it('rateLimitedResponse creates 429 response (AC-02)', async () => {
      // Act
      const response = rateLimitedResponse(30);

      // Assert
      expect(response.status).toBe(429);
      expect(response.ok).toBe(false);
      expect(response.statusText).toBe('Too Many Requests');
      expect(response.headers.get('Retry-After')).toBe('30');
    });

    it('rateLimitedResponse works without Retry-After header (AC-02)', () => {
      // Act
      const response = rateLimitedResponse();

      // Assert
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBeNull();
    });

    it('serverErrorResponse creates 500 response (AC-02)', async () => {
      // Act
      const response = serverErrorResponse('Database unavailable');

      // Assert
      expect(response.status).toBe(500);
      expect(response.ok).toBe(false);
      expect(response.statusText).toBe('Internal Server Error');
      const body = (await response.json()) as { errorMessages: string[] };
      expect(body.errorMessages).toContain('Database unavailable');
    });

    it('forbiddenResponse creates 403 response (AC-02)', () => {
      // Act
      const response = forbiddenResponse('No admin access');

      // Assert
      expect(response.status).toBe(403);
      expect(response.ok).toBe(false);
      expect(response.statusText).toBe('Forbidden');
    });
  });

  // ─── Mock Function Factories ───────────

  describe('mock function factories', () => {
    it('createMockRequestJira returns jest.Mock that resolves with default response (AC-03)', async () => {
      // Arrange
      const defaultResp = okResponse({ key: 'TEST-1' });
      const mockJira = createMockRequestJira(defaultResp);

      // Act
      const result = await mockJira('/rest/api/2/issue/TEST-1');

      // Assert
      expect(mockJira).toHaveBeenCalledWith('/rest/api/2/issue/TEST-1');
      expect(result.status).toBe(200);
      expect(result).toBe(defaultResp);
    });

    it('createMockRequestJira can be configured with mockResolvedValueOnce (AC-03)', async () => {
      // Arrange
      const mockJira = createMockRequestJira();
      const notFound = notFoundResponse();
      mockJira.mockResolvedValueOnce(notFound);

      // Act
      const result = await mockJira('/rest/api/2/issue/MISSING');

      // Assert
      expect(result.status).toBe(404);
    });

    it('createMockRequestConfluence returns jest.Mock that resolves with default response (AC-03)', async () => {
      // Arrange
      const defaultResp = okResponse({ results: [] });
      const mockConfluence = createMockRequestConfluence(defaultResp);

      // Act
      const result = await mockConfluence('/wiki/rest/api/content');

      // Assert
      expect(mockConfluence).toHaveBeenCalledWith('/wiki/rest/api/content');
      expect(result).toBe(defaultResp);
    });

    it('createMockForgeFetch returns jest.Mock that resolves with default response (AC-03)', async () => {
      // Arrange
      const defaultResp = okResponse({ id: 123, state: 'open' });
      const mockFetch = createMockForgeFetch(defaultResp);

      // Act
      const result = await mockFetch('https://api.github.com/repos/org/repo/pulls/123');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('https://api.github.com/repos/org/repo/pulls/123');
      expect(result).toBe(defaultResp);
    });

    it('mock factories accept MockRoute as first argument (AC-03)', async () => {
      // Arrange
      const mockJira = createMockRequestJira();
      const mockRoute: MockRoute = { value: '/rest/api/2/issue/TEST-1' };

      // Act
      await mockJira(mockRoute, { method: 'GET' });

      // Assert
      expect(mockJira).toHaveBeenCalledWith(mockRoute, { method: 'GET' });
    });
  });

  // ─── createMockRoute() ─────────────────

  describe('createMockRoute()', () => {
    it('should interpolate string params into MockRoute (AC-04)', () => {
      // Arrange
      const mockRoute = createMockRoute();
      const issueKey = 'PROJ-123';

      // Act
      const result = mockRoute`/rest/api/2/issue/${issueKey}`;

      // Assert
      expect(result.value).toBe('/rest/api/2/issue/PROJ-123');
    });

    it('should interpolate number params into MockRoute (AC-04)', () => {
      // Arrange
      const mockRoute = createMockRoute();
      const transitionId = 31;

      // Act
      const result = mockRoute`/rest/api/2/issue/PROJ-1/transitions/${transitionId}`;

      // Assert
      expect(result.value).toBe('/rest/api/2/issue/PROJ-1/transitions/31');
    });

    it('should interpolate nested MockRoute params (AC-04)', () => {
      // Arrange
      const mockRoute = createMockRoute();
      const nested: MockRoute = { value: '/api/inner' };

      // Act
      const result = mockRoute`/prefix${nested}/suffix`;

      // Assert
      expect(result.value).toBe('/prefix/api/inner/suffix');
    });

    it('should handle template with no params (AC-04)', () => {
      // Arrange
      const mockRoute = createMockRoute();

      // Act
      const result = mockRoute`/rest/api/2/myself`;

      // Assert
      expect(result.value).toBe('/rest/api/2/myself');
    });
  });

  // ─── createForgeApiMockSet() ────────────

  describe('createForgeApiMockSet()', () => {
    it('should return all mock functions (AC-05)', () => {
      // Act
      const mockSet = createForgeApiMockSet();

      // Assert
      expect(mockSet.requestJira).toBeDefined();
      expect(mockSet.requestConfluence).toBeDefined();
      expect(mockSet.fetch).toBeDefined();
      expect(mockSet.route).toBeDefined();
      expect(mockSet.defaultResponse).toBeDefined();
      expect(typeof mockSet.route).toBe('function');
    });

    it('should use the provided default response for all mocks (AC-05)', async () => {
      // Arrange
      const customResponse = okResponse({ custom: true });
      const mockSet = createForgeApiMockSet(customResponse);

      // Act
      const jiraResult = await mockSet.requestJira('/test');
      const confluenceResult = await mockSet.requestConfluence('/test');
      const fetchResult = await mockSet.fetch('/test');

      // Assert
      expect(jiraResult).toBe(customResponse);
      expect(confluenceResult).toBe(customResponse);
      expect(fetchResult).toBe(customResponse);
    });

    it('should use okResponse({}) as default when no response provided (AC-05)', async () => {
      // Act
      const mockSet = createForgeApiMockSet();

      // Assert
      expect(mockSet.defaultResponse.status).toBe(200);
      expect(mockSet.defaultResponse.ok).toBe(true);
    });
  });

  // ─── createForgeApiModuleMock() ─────────

  describe('createForgeApiModuleMock()', () => {
    it('should return object with all required keys (AC-05)', () => {
      // Act
      const moduleMock = createForgeApiModuleMock();

      // Assert
      expect(moduleMock).toHaveProperty('requestJira');
      expect(moduleMock).toHaveProperty('requestConfluence');
      expect(moduleMock).toHaveProperty('fetch');
      expect(moduleMock).toHaveProperty('route');
    });

    it('should return jest mock functions that work (AC-05)', async () => {
      // Arrange
      const moduleMock = createForgeApiModuleMock();
      const requestJira = moduleMock['requestJira'] as jest.Mock;

      // Act
      const result = await requestJira('/test');

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe(200);
    });
  });

  // ─── Type Safety ────────────────────────

  describe('type safety', () => {
    it('MockAPIResponse should have all required fields (AC-06)', () => {
      // Arrange
      const response: MockAPIResponse = createMockResponse();

      // Assert — if this compiles, types are correct
      expect(typeof response.json).toBe('function');
      expect(typeof response.text).toBe('function');
      expect(typeof response.arrayBuffer).toBe('function');
      expect(typeof response.ok).toBe('boolean');
      expect(typeof response.status).toBe('number');
      expect(typeof response.statusText).toBe('string');
      expect(typeof response.headers.get).toBe('function');
      expect(typeof response.headers.has).toBe('function');
      expect(typeof response.headers.forEach).toBe('function');
    });

    it('MockRoute should have value property (AC-06)', () => {
      // Arrange
      const mockRoute = createMockRoute();
      const route: MockRoute = mockRoute`/test`;

      // Assert
      expect(typeof route.value).toBe('string');
    });
  });
});
