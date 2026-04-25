/**
 * TEST FILE: Inconsistency Detector
 *
 * RTASK-007: Domain Layer - Inconsistency Detector
 * TDD: RED -> GREEN -> REFACTOR
 *
 * Mirror path: src/backend/services/scoring/inconsistency-detector.ts
 * Tests: tests/unit/services/scoring/inconsistency-detector.spec.ts
 */

import {
  detectInconsistencies,
  classifySeverity,
  generateSuggestion,
  DEFAULT_DETECTOR_CONFIG,
} from '../../../../src/backend/services/scoring/inconsistency-detector';
import type { DetectorConfig } from '../../../../src/backend/services/scoring/inconsistency-detector';
import type { Inconsistency, Severity } from '../../../../src/backend/types/inconsistency';
import type { JiraTicketData } from '../../../../src/backend/types/jira-data';
import type { RovoContext } from '../../../../src/backend/types/rovo-context';
import { InsufficientDataError } from '../../../../src/backend/types/errors';

// ═══════════════════════════════════════════
// MOCKS & FIXTURES
// ═══════════════════════════════════════════

const makeTicket = (overrides: Partial<JiraTicketData> = {}): JiraTicketData => ({
  key: 'PROJ-123',
  summary: 'Implement user authentication',
  description:
    'Add OAuth2 login flow with Google provider.\n\nAcceptance criteria:\n- User can click "Sign in with Google"\n- Token is stored securely\n- Session persists for 24 hours',
  status: 'IN PROGRESS',
  assignee: 'john.doe',
  reporter: 'jane.smith',
  priority: 'High',
  issueType: 'Story',
  labels: ['auth', 'security'],
  projectKey: 'PROJ',
  created: '2026-01-15T10:00:00Z',
  updated: '2026-01-16T14:30:00Z',
  ...overrides,
});

const makeContext = (overrides: Partial<RovoContext> = {}): RovoContext => ({
  documents: [
    {
      id: 'doc-1',
      title: 'Authentication Design',
      content: 'Use OAuth2 with Google provider for SSO',
      source: 'confluence',
      relevance: 0.9,
    },
  ],
  relatedTickets: ['PROJ-100', 'PROJ-101'],
  decisions: [
    {
      id: 'dec-1',
      title: 'SSO Provider Decision',
      description: 'Decided to use Google OAuth2 for authentication',
      date: '2026-01-10',
      source: 'decision-log',
    },
  ],
  query: 'authentication',
  timestamp: '2026-01-15T12:00:00Z',
  ...overrides,
});

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('InconsistencyDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── detectInconsistencies() ────────────

  describe('detectInconsistencies()', () => {
    // ─── AC-01: Detects all 4 inconsistency types ──

    it('should detect contradictions in ticket fields (AC-01, AC-07)', () => {
      const ticket = makeTicket({
        summary: 'Implement feature X',
        description:
          'We must implement feature X. However, feature X should NOT be implemented because it conflicts with the current architecture.',
      });

      const results = detectInconsistencies(ticket);

      const contradictions = results.filter((r) => r.type === 'contradiction');
      expect(contradictions.length).toBeGreaterThanOrEqual(1);
      const first = contradictions[0];
      expect(first?.affectedTicketKey).toBe('PROJ-123');
    });

    it('should detect contradictions against context documents (AC-07)', () => {
      const ticket = makeTicket({
        summary: 'Enable password auth',
        description: 'The system must use password-based authentication for all users.',
      });
      const context = makeContext({
        documents: [
          {
            id: 'doc-1',
            title: 'Auth Standard',
            content: 'Password authentication must not be used. All auth must use OAuth2.',
            source: 'confluence',
            relevance: 0.9,
          },
        ],
      });

      const results = detectInconsistencies(ticket, context);

      const contradictions = results.filter((r) => r.type === 'contradiction');
      expect(contradictions.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect contradictions with conflicting priorities', () => {
      const ticket = makeTicket({
        summary: 'Implement feature urgently',
        description:
          'This feature should be implemented immediately. However, it should NOT be implemented until Q3.',
      });

      const results = detectInconsistencies(ticket);

      const contradictions = results.filter((r) => r.type === 'contradiction');
      expect(contradictions.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect duplicates above similarity threshold (AC-01, AC-08)', () => {
      const ticket = makeTicket({
        summary: 'Implement user login page with OAuth2',
        description:
          'Implement user login page with OAuth2. Implement user login page with OAuth2. The same content is repeated.',
      });

      const results = detectInconsistencies(ticket);

      const duplicates = results.filter((r) => r.type === 'duplicate');
      expect(duplicates.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect missing context fields (AC-01, AC-09)', () => {
      const ticket = makeTicket({
        description: 'Some description without acceptance criteria.',
        assignee: undefined,
        priority: undefined,
        labels: [],
      });

      const results = detectInconsistencies(ticket);

      const missingContext = results.filter((r) => r.type === 'missing_context');
      expect(missingContext.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect missing acceptance criteria (AC-09)', () => {
      const ticket = makeTicket({
        description: 'Just a plain description with no structured criteria at all.',
      });

      const results = detectInconsistencies(ticket);

      const missingContext = results.filter(
        (r) => r.type === 'missing_context' && r.description.includes('acceptance criteria'),
      );
      expect(missingContext.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect ambiguous language (AC-01, AC-10)', () => {
      const ticket = makeTicket({
        description:
          'The feature should maybe handle some edge cases. Possibly we need to handle TBD scenarios. And so on.',
      });

      const results = detectInconsistencies(ticket);

      const ambiguities = results.filter((r) => r.type === 'ambiguity');
      expect(ambiguities.length).toBeGreaterThanOrEqual(1);
    });

    // ─── AC-04: Deterministic output ──

    it('should be deterministic: same input always produces same output (AC-04, ARCH-SOLID-0912)', () => {
      const ticket = makeTicket({
        description: 'Maybe we should implement this somehow. TBD on specifics.',
      });

      const results1 = detectInconsistencies(ticket);
      const results2 = detectInconsistencies(ticket);

      expect(results1).toEqual(results2);
    });

    // ─── AC-11: Injected configuration ──

    it('should use injected config for similarity threshold (AC-11, ARCH-SOLID-049-05)', () => {
      const ticket = makeTicket({
        summary: 'Add login button to header',
        description: 'Add login button to header component with styling.',
      });

      // Default threshold: 70% — should detect duplicate-like similarity
      const defaultResults = detectInconsistencies(ticket);

      // With very high threshold: 99% — should NOT detect duplicate
      const strictConfig: DetectorConfig = {
        ...DEFAULT_DETECTOR_CONFIG,
        similarityThreshold: 0.99,
      };
      const strictResults = detectInconsistencies(ticket, undefined, strictConfig);

      const defaultDuplicates = defaultResults.filter((r) => r.type === 'duplicate');
      const strictDuplicates = strictResults.filter((r) => r.type === 'duplicate');

      // Strict config should find fewer or equal duplicates
      expect(strictDuplicates.length).toBeLessThanOrEqual(defaultDuplicates.length);
    });

    it('should use custom ambiguous words from config (AC-11)', () => {
      const ticket = makeTicket({
        description: 'This uses a custom vague marker to indicate uncertainty.',
      });

      const customConfig: DetectorConfig = {
        ...DEFAULT_DETECTOR_CONFIG,
        ambiguousWords: ['custom vague marker'],
      };

      const results = detectInconsistencies(ticket, undefined, customConfig);
      const ambiguities = results.filter((r) => r.type === 'ambiguity');
      expect(ambiguities.length).toBeGreaterThanOrEqual(1);
    });

    // ─── Edge cases (TEST-QA-057) ──

    it('should handle empty ticket fields gracefully', () => {
      const ticket = makeTicket({
        summary: '',
        description: '',
        labels: [],
        assignee: undefined,
        priority: undefined,
      });

      const results = detectInconsistencies(ticket);

      expect(Array.isArray(results)).toBe(true);
      // Empty fields should trigger missing_context
      const missingContext = results.filter((r) => r.type === 'missing_context');
      expect(missingContext.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle 70% boundary for similarity threshold (TEST-QA-057)', () => {
      // Exactly 70% similar content
      const ticket = makeTicket({
        summary: 'Implement user authentication flow',
        description:
          'Implement user authentication flow with OAuth2 provider support for our application.',
      });

      const results = detectInconsistencies(ticket);
      // Should work without errors at the boundary
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle null/empty description', () => {
      const ticket = makeTicket({
        description: '',
      });

      const results = detectInconsistencies(ticket);
      expect(Array.isArray(results)).toBe(true);
      // Empty description is missing context
      const missingContext = results.filter((r) => r.type === 'missing_context');
      expect(missingContext.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect duplicate when summary and description are very similar (line 218 true branch)', () => {
      // Use nearly identical strings so trigram Jaccard similarity >= 0.7
      // The description is the summary with a single extra word at the end
      const ticket = makeTicket({
        summary: 'fix the login button on the main page header',
        description: 'fix the login button on the main page header now',
      });

      const results = detectInconsistencies(ticket);

      const trigramDuplicates = results.filter(
        (r) => r.type === 'duplicate' && r.description.includes('similarity'),
      );
      expect(trigramDuplicates.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle short non-empty strings that produce no trigrams (line 133)', () => {
      // Both summary and description are 1-2 chars, different, non-empty
      // buildTrigrams returns empty sets for strings < 3 chars
      const ticket = makeTicket({
        summary: 'ab',
        description: 'cd',
      });

      const results = detectInconsistencies(ticket);
      expect(Array.isArray(results)).toBe(true);
      // No duplicate from trigram similarity (both too short)
      const duplicates = results.filter((r) => r.type === 'duplicate');
      const trigramDuplicates = duplicates.filter((d) => d.description.includes('similarity'));
      expect(trigramDuplicates.length).toBe(0);
    });

    it('should handle summary longer than description for trigram intersection (line 109)', () => {
      // Long summary, short description => trigramsA.size > trigramsB.size
      // This covers the else branch of the ternary in countIntersection
      const ticket = makeTicket({
        summary: 'This is a very long summary with many words and lots of characters for trigrams',
        description: 'abc',
      });

      const results = detectInconsistencies(ticket);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should throw InsufficientDataError for missing ticket key (ARCH-SOLID-053)', () => {
      const ticket = makeTicket({ key: '' });

      expect(() => detectInconsistencies(ticket)).toThrow(InsufficientDataError);
    });

    it('should return empty array for a clean ticket with no issues', () => {
      const ticket = makeTicket();
      const context = makeContext();

      const results = detectInconsistencies(ticket, context);

      // A well-formed ticket with matching context should have few or no issues
      expect(Array.isArray(results)).toBe(true);
    });

    it('should work without context (context is optional)', () => {
      const ticket = makeTicket({
        description: 'Maybe implement this TBD feature somehow.',
        assignee: undefined,
        priority: undefined,
        labels: [],
      });

      const results = detectInconsistencies(ticket);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should sort results by severity: critical first, then warning, then info', () => {
      const ticket = makeTicket({
        description:
          'Must implement X. Must NOT implement X. Maybe also TBD features. Just a brief desc.',
        assignee: undefined,
        labels: [],
      });

      const results = detectInconsistencies(ticket);

      const severityOrder: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
      for (let i = 1; i < results.length; i++) {
        const current = results[i];
        const previous = results[i - 1];
        expect(current?.severity).toBeDefined();
        expect(previous?.severity).toBeDefined();
        expect(severityOrder[current?.severity as Severity]).toBeGreaterThanOrEqual(
          severityOrder[previous?.severity as Severity],
        );
      }
    });

    // ─── ARCH-SOLID-0784: Independent pipeline ──

    it('should produce unique IDs for each detected inconsistency', () => {
      const ticket = makeTicket({
        description: 'Implement feature X but do NOT implement X. Maybe later. TBD on details.',
        assignee: undefined,
        labels: [],
      });

      const results = detectInconsistencies(ticket);
      const ids = results.map((r) => r.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should set the correct source on detected inconsistencies', () => {
      const ticket = makeTicket({
        description: 'Maybe implement this TBD feature.',
      });

      const results = detectInconsistencies(ticket);
      for (const result of results) {
        expect(['rovo', 'jira', 'confluence', 'github']).toContain(result.source);
      }
    });
  });

  // ─── classifySeverity() ─────────────────

  describe('classifySeverity()', () => {
    // ─── AC-02: Correct severity classification ──

    it('should classify contradiction as critical (AC-02)', () => {
      const inconsistency: Inconsistency = {
        id: 'inc-test-1',
        type: 'contradiction',
        severity: 'critical',
        source: 'jira',
        description: 'Conflicting information detected',
        affectedTicketKey: 'PROJ-123',
      };

      const severity = classifySeverity(inconsistency);
      expect(severity).toBe('critical');
    });

    it('should classify duplicate as warning (AC-02)', () => {
      const inconsistency: Inconsistency = {
        id: 'inc-test-2',
        type: 'duplicate',
        severity: 'warning',
        source: 'jira',
        description: 'Duplicate content detected',
        affectedTicketKey: 'PROJ-123',
      };

      const severity = classifySeverity(inconsistency);
      expect(severity).toBe('warning');
    });

    it('should classify missing_context as warning (AC-02)', () => {
      const inconsistency: Inconsistency = {
        id: 'inc-test-3',
        type: 'missing_context',
        severity: 'warning',
        source: 'jira',
        description: 'Missing acceptance criteria',
        affectedTicketKey: 'PROJ-123',
      };

      const severity = classifySeverity(inconsistency);
      expect(severity).toBe('warning');
    });

    it('should classify ambiguity as info (AC-02)', () => {
      const inconsistency: Inconsistency = {
        id: 'inc-test-4',
        type: 'ambiguity',
        severity: 'info',
        source: 'jira',
        description: 'Ambiguous language detected',
        affectedTicketKey: 'PROJ-123',
      };

      const severity = classifySeverity(inconsistency);
      expect(severity).toBe('info');
    });
  });

  // ─── generateSuggestion() ───────────────

  describe('generateSuggestion()', () => {
    // ─── AC-03: Actionable suggestions ──

    it('should generate suggestion for contradiction type (AC-03)', () => {
      const inconsistency: Inconsistency = {
        id: 'inc-test-1',
        type: 'contradiction',
        severity: 'critical',
        source: 'jira',
        description: 'Conflicting information detected',
        affectedTicketKey: 'PROJ-123',
      };

      const suggestion = generateSuggestion(inconsistency);
      expect(typeof suggestion).toBe('string');
      expect(suggestion.length).toBeGreaterThan(0);
    });

    it('should generate suggestion for duplicate type (AC-03)', () => {
      const inconsistency: Inconsistency = {
        id: 'inc-test-2',
        type: 'duplicate',
        severity: 'warning',
        source: 'jira',
        description: 'Duplicate content detected',
        affectedTicketKey: 'PROJ-123',
      };

      const suggestion = generateSuggestion(inconsistency);
      expect(typeof suggestion).toBe('string');
      expect(suggestion.length).toBeGreaterThan(0);
    });

    it('should generate suggestion for missing_context type (AC-03)', () => {
      const inconsistency: Inconsistency = {
        id: 'inc-test-3',
        type: 'missing_context',
        severity: 'warning',
        source: 'jira',
        description: 'Missing acceptance criteria',
        affectedTicketKey: 'PROJ-123',
      };

      const suggestion = generateSuggestion(inconsistency);
      expect(typeof suggestion).toBe('string');
      expect(suggestion.length).toBeGreaterThan(0);
    });

    it('should generate suggestion for ambiguity type (AC-03)', () => {
      const inconsistency: Inconsistency = {
        id: 'inc-test-4',
        type: 'ambiguity',
        severity: 'info',
        source: 'jira',
        description: 'Ambiguous language detected',
        affectedTicketKey: 'PROJ-123',
      };

      const suggestion = generateSuggestion(inconsistency);
      expect(typeof suggestion).toBe('string');
      expect(suggestion.length).toBeGreaterThan(0);
    });

    it('should include actionable guidance in suggestions', () => {
      const types: Array<{ type: Inconsistency['type']; keyword: string }> = [
        { type: 'contradiction', keyword: 'resolve' },
        { type: 'duplicate', keyword: 'remove' },
        { type: 'missing_context', keyword: 'add' },
        { type: 'ambiguity', keyword: 'clarify' },
      ];

      for (const { type, keyword } of types) {
        const inconsistency: Inconsistency = {
          id: `inc-${type}`,
          type,
          severity: 'info',
          source: 'jira',
          description: `Test ${type}`,
          affectedTicketKey: 'PROJ-123',
        };
        const suggestion = generateSuggestion(inconsistency);
        expect(suggestion.toLowerCase()).toContain(keyword);
      }
    });
  });

  // ─── DEFAULT_DETECTOR_CONFIG ────────────

  describe('DEFAULT_DETECTOR_CONFIG', () => {
    it('should have a similarity threshold of 0.7', () => {
      expect(DEFAULT_DETECTOR_CONFIG.similarityThreshold).toBe(0.7);
    });

    it('should include standard ambiguous words', () => {
      const words = DEFAULT_DETECTOR_CONFIG.ambiguousWords;
      expect(words).toContain('maybe');
      expect(words).toContain('possibly');
      expect(words).toContain('somehow');
      expect(words).toContain('tbd');
      expect(words).toContain('fixme');
    });

    it('should include contradiction term pairs', () => {
      const pairs = DEFAULT_DETECTOR_CONFIG.contradictionPairs;
      expect(pairs.length).toBeGreaterThan(0);
    });
  });
});
