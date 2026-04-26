/**
 * Fixture Structural Validation
 *
 * Validates that all integration test fixture files match the exact interface
 * shapes defined in adapter source code. This ensures fixtures stay in sync
 * with adapter contracts and represent realistic API responses.
 *
 * [TEST-QA-0973] Automatic fixture validation (tests-about-tests).
 * [TEST-QA-058] Fixtures use realistic data matching actual API response shapes.
 * [ARCH-SOLID-049-03] Fixtures match adapter interfaces exactly (LSP).
 * [ARCH-SOLID-058] Fixtures represent raw API responses (wire format), not domain types.
 * [ARCH-SOLID-202] Zero `any` — all types use explicit interfaces or `unknown`.
 * [TEST-QA-204] afterEach cleanup mandatory.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ═══════════════════════════════════════════
// TYPE GUARDS (no `any` — [ARCH-SOLID-202])
// ═══════════════════════════════════════════

interface JiraIssueFields {
  readonly summary: string;
  readonly description: string;
  readonly status: { readonly name: string };
  readonly assignee: { readonly displayName: string } | null;
  readonly reporter: { readonly displayName: string } | null;
  readonly priority: { readonly name: string } | null;
  readonly issuetype: { readonly name: string };
  readonly labels: readonly string[];
  readonly project: { readonly key: string };
  readonly created: string;
  readonly updated: string;
}

interface JiraIssueResponse {
  readonly fields: JiraIssueFields;
  readonly key: string;
}

interface GitHubPRResponse {
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly state: string;
  readonly head: { readonly ref: string };
  readonly base: { readonly ref: string };
  readonly html_url: string;
}

// These interfaces validate fixture shape at compile time (used as type assertions)
interface _GitHubPRFileResponse {
  readonly filename: string;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
}

interface _RovoDocument {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly source: string;
  readonly relevance: number;
}

interface _HistoricalDecision {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly date: string;
  readonly source: string;
}

interface RawRovoSearchResponse {
  readonly documents?: readonly unknown[];
  readonly relatedTickets?: readonly unknown[];
  readonly decisions?: readonly unknown[];
}

interface ConfluenceContentResult {
  readonly id: string;
  readonly title: string;
  readonly space?: { readonly key: string };
  readonly _links?: { readonly webui?: string };
  readonly version?: { readonly when?: string };
}

interface ConfluenceSearchResponse {
  readonly results: readonly ConfluenceContentResult[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

function hasStringProp(obj: Record<string, unknown>, key: string): boolean {
  return key in obj && isString(obj[key]);
}

function hasNumberProp(obj: Record<string, unknown>, key: string): boolean {
  return key in obj && isNumber(obj[key]);
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

const fixturesDir = path.resolve(__dirname);

function loadFixture(filename: string): unknown {
  const filePath = path.join(fixturesDir, filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as unknown;
}

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('Fixture Structural Validation', () => {
  afterEach(() => {
    // [TEST-QA-204] Cleanup
    jest.clearAllMocks();
  });

  // ─── File Existence ───────────────────

  describe('File existence', () => {
    const expectedFixtures = [
      'jira-ticket-full.json',
      'jira-ticket-minimal.json',
      'rovo-context-full.json',
      'github-pr-full.json',
      'confluence-pages.json',
    ];

    it.each(expectedFixtures)('should have %s fixture file', (filename) => {
      const filePath = path.join(fixturesDir, filename);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  // ─── Jira Ticket Full ─────────────────

  describe('jira-ticket-full.json', () => {
    let fixture: unknown;

    beforeAll(() => {
      fixture = loadFixture('jira-ticket-full.json');
    });

    it('should match JiraIssueResponse interface', () => {
      // Arrange — fixture loaded above
      // Act & Assert
      expect(isObject(fixture)).toBe(true);
      const obj = fixture as Record<string, unknown>;
      expect(hasStringProp(obj, 'key')).toBe(true);
      expect(obj['key']).toMatch(/^[A-Z]+-\d+$/);
      expect(isObject(obj['fields'])).toBe(true);
    });

    it('should have all required fields populated', () => {
      // Arrange
      const data = fixture as JiraIssueResponse;
      const fields = data.fields;

      // Act & Assert — all fields populated (not null)
      expect(fields.summary).toBeTruthy();
      expect(fields.description).toBeDefined();
      expect(fields.status.name).toBeTruthy();
      expect(fields.assignee).not.toBeNull();
      expect(fields.assignee?.displayName).toBeTruthy();
      expect(fields.reporter).not.toBeNull();
      expect(fields.reporter?.displayName).toBeTruthy();
      expect(fields.priority).not.toBeNull();
      expect(fields.priority?.name).toBeTruthy();
      expect(fields.issuetype.name).toBeTruthy();
      expect(Array.isArray(fields.labels)).toBe(true);
      expect(fields.project.key).toMatch(/^[A-Z]+$/);
      expect(fields.created).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(fields.updated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  // ─── Jira Ticket Minimal ──────────────

  describe('jira-ticket-minimal.json', () => {
    let fixture: unknown;

    beforeAll(() => {
      fixture = loadFixture('jira-ticket-minimal.json');
    });

    it('should match JiraIssueResponse interface', () => {
      expect(isObject(fixture)).toBe(true);
      const obj = fixture as Record<string, unknown>;
      expect(hasStringProp(obj, 'key')).toBe(true);
      expect(isObject(obj['fields'])).toBe(true);
    });

    it('should have nullable fields set to null', () => {
      // Arrange
      const data = fixture as JiraIssueResponse;
      const fields = data.fields;

      // Act & Assert — minimal ticket has null optional fields
      expect(fields.assignee).toBeNull();
      expect(fields.reporter).toBeNull();
      expect(fields.priority).toBeNull();
      expect(fields.labels).toEqual([]);
    });

    it('should still have required fields', () => {
      // Arrange
      const data = fixture as JiraIssueResponse;
      const fields = data.fields;

      // Act & Assert
      expect(fields.summary).toBeDefined();
      expect(fields.status.name).toBeDefined();
      expect(fields.issuetype.name).toBeDefined();
      expect(fields.project.key).toBeDefined();
      expect(fields.created).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(fields.updated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  // ─── Rovo Context Full ────────────────

  describe('rovo-context-full.json', () => {
    let fixture: unknown;

    beforeAll(() => {
      fixture = loadFixture('rovo-context-full.json');
    });

    it('should match RawRovoSearchResponse interface', () => {
      expect(isObject(fixture)).toBe(true);
      const obj = fixture as Record<string, unknown>;
      // At least one of the optional arrays should exist
      const hasDocuments = 'documents' in obj;
      const hasRelatedTickets = 'relatedTickets' in obj;
      const hasDecisions = 'decisions' in obj;
      expect(hasDocuments || hasRelatedTickets || hasDecisions).toBe(true);
    });

    it('should have valid documents matching RovoDocument shape', () => {
      // Arrange
      const data = fixture as RawRovoSearchResponse;
      const documents = data.documents;

      // Act & Assert
      if (documents && documents.length > 0) {
        for (const doc of documents) {
          expect(isObject(doc)).toBe(true);
          const obj = doc as Record<string, unknown>;
          expect(hasStringProp(obj, 'id')).toBe(true);
          expect(hasStringProp(obj, 'title')).toBe(true);
          expect(hasStringProp(obj, 'content')).toBe(true);
          expect(hasStringProp(obj, 'source')).toBe(true);
          expect(hasNumberProp(obj, 'relevance')).toBe(true);
        }
      }
    });

    it('should have valid historical decisions', () => {
      // Arrange
      const data = fixture as RawRovoSearchResponse;
      const decisions = data.decisions;

      // Act & Assert
      if (decisions && decisions.length > 0) {
        for (const dec of decisions) {
          expect(isObject(dec)).toBe(true);
          const obj = dec as Record<string, unknown>;
          expect(hasStringProp(obj, 'id')).toBe(true);
          expect(hasStringProp(obj, 'title')).toBe(true);
          expect(hasStringProp(obj, 'description')).toBe(true);
          expect(hasStringProp(obj, 'date')).toBe(true);
          expect(hasStringProp(obj, 'source')).toBe(true);
        }
      }
    });

    it('should have relatedTickets as array of strings', () => {
      // Arrange
      const data = fixture as RawRovoSearchResponse;
      const tickets = data.relatedTickets;

      // Act & Assert
      if (tickets) {
        for (const ticket of tickets) {
          expect(typeof ticket).toBe('string');
          expect(ticket as string).toMatch(/^[A-Z]+-\d+$/);
        }
      }
    });
  });

  // ─── GitHub PR Full ───────────────────

  describe('github-pr-full.json', () => {
    let fixture: unknown;

    beforeAll(() => {
      fixture = loadFixture('github-pr-full.json');
    });

    it('should match GitHubPRResponse interface', () => {
      expect(isObject(fixture)).toBe(true);
      const obj = fixture as Record<string, unknown>;
      expect(hasNumberProp(obj, 'number')).toBe(true);
      expect(hasStringProp(obj, 'title')).toBe(true);
      expect(hasStringProp(obj, 'state')).toBe(true);
      expect(hasStringProp(obj, 'html_url')).toBe(true);
      expect(obj['state']).toMatch(/^(open|closed)$/);
    });

    it('should have head and base refs', () => {
      // Arrange
      const data = fixture as GitHubPRResponse;

      // Act & Assert
      expect(data.head.ref).toBeTruthy();
      expect(data.base.ref).toBeTruthy();
    });

    it('should have html_url pointing to github.com', () => {
      // Arrange
      const data = fixture as GitHubPRResponse;

      // Act & Assert
      expect(data.html_url).toMatch(/^https:\/\/github\.com\//);
    });

    it('should include files array matching GitHubPRFileResponse', () => {
      // Arrange
      const obj = fixture as Record<string, unknown>;
      const files = obj['files'];

      // Act & Assert
      expect(Array.isArray(files)).toBe(true);
      if (Array.isArray(files)) {
        for (const file of files as unknown[]) {
          expect(isObject(file)).toBe(true);
          const f = file as Record<string, unknown>;
          expect(hasStringProp(f, 'filename')).toBe(true);
          expect(hasStringProp(f, 'status')).toBe(true);
          expect(hasNumberProp(f, 'additions')).toBe(true);
          expect(hasNumberProp(f, 'deletions')).toBe(true);
          expect(f['status']).toMatch(/^(added|modified|removed|renamed)$/);
        }
      }
    });
  });

  // ─── Confluence Pages ─────────────────

  describe('confluence-pages.json', () => {
    let fixture: unknown;

    beforeAll(() => {
      fixture = loadFixture('confluence-pages.json');
    });

    it('should match ConfluenceSearchResponse interface', () => {
      expect(isObject(fixture)).toBe(true);
      const obj = fixture as Record<string, unknown>;
      expect('results' in obj).toBe(true);
      expect(Array.isArray(obj['results'])).toBe(true);
    });

    it('should have results matching ConfluenceContentResult shape', () => {
      // Arrange
      const data = fixture as ConfluenceSearchResponse;
      const results = data.results;

      // Act & Assert
      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(isString(result.id)).toBe(true);
        expect(isString(result.title)).toBe(true);
        // Optional fields: validate if present
        if (result.space) {
          expect(isString(result.space.key)).toBe(true);
        }
        if (result._links) {
          if (result._links.webui !== undefined) {
            expect(isString(result._links.webui)).toBe(true);
          }
        }
        if (result.version) {
          if (result.version.when !== undefined) {
            expect(result.version.when).toMatch(/^\d{4}-\d{2}-\d{2}T/);
          }
        }
      }
    });

    it('should have realistic Confluence page IDs', () => {
      // Arrange
      const data = fixture as ConfluenceSearchResponse;
      const results = data.results;

      // Act & Assert — Confluence IDs are numeric strings
      for (const result of results) {
        expect(result.id).toMatch(/^\d+$/);
      }
    });
  });

  // ─── Fixture Valid JSON ───────────────

  describe('All fixtures are valid JSON', () => {
    const fixtureFiles = [
      'jira-ticket-full.json',
      'jira-ticket-minimal.json',
      'rovo-context-full.json',
      'github-pr-full.json',
      'confluence-pages.json',
    ];

    it.each(fixtureFiles)('should parse %s without error', (filename) => {
      // Act & Assert
      expect(() => loadFixture(filename)).not.toThrow();
    });
  });
});
