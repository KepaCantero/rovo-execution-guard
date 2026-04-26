/**
 * Test suite for pr-comment-formatter.ts
 *
 * Mirrors: src/backend/services/github/pr-comment-formatter.ts
 * Tests: AC-01 through AC-08
 * Rules: SEC-PRIV-002, SEC-PRIV-004, SEC-PRIV-051, SEC-PRIV-0914,
 *        ARCH-SOLID-058, ARCH-SOLID-069, ARCH-SOLID-202, ARCH-SOLID-203,
 *        ARCH-SOLID-205, ARCH-SOLID-232, ARCH-SOLID-052, ARCH-SOLID-054,
 *        GH-INTEG-305, TEST-QA-056, TEST-QA-057, UI-ADS-0821, UI-ADS-0862
 */

import {
  formatPassedComment,
  formatFailedComment,
  formatContextComment,
  sanitizeMarkdown,
} from '../../../../src/backend/services/github/pr-comment-formatter';

import type { CommentTemplateConfig } from '../../../../src/backend/services/github/pr-comment-formatter';
import type { EvaluationPipelineResult } from '../../../../src/backend/services/evaluation/evaluation-pipeline';
import type { RovoContext } from '../../../../src/backend/types/rovo-context';

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const createPassedResult = (): EvaluationPipelineResult => ({
  executionId: 'ep-test-passed-001',
  ticketKey: 'PROJ-123',
  gateType: 'execution',
  score: {
    overall: 92,
    axes: {
      clarity: 90,
      consistency: 95,
      risk: 85,
      documentation: 88,
      technicalDebt: 80,
    },
    timestamp: '2026-04-25T10:00:00.000Z',
    executionId: 'ep-test-passed-001',
  },
  inconsistencies: [],
  gateResult: {
    gate: 'execution',
    passed: true,
    score: {
      overall: 92,
      axes: {
        clarity: 90,
        consistency: 95,
        risk: 85,
        documentation: 88,
        technicalDebt: 80,
      },
      timestamp: '2026-04-25T10:00:00.000Z',
      executionId: 'ep-test-passed-001',
    },
    inconsistencies: [],
    blockedTransitions: [],
    executionId: 'ep-test-passed-001',
  },
  enforcementActions: [],
  auditEntry: {
    id: 'audit-test-001',
    action: 'gate_evaluated',
    timestamp: '2026-04-25T10:00:00.000Z',
    executionId: 'ep-test-passed-001',
    projectKey: 'PROJ',
    ticketKey: 'PROJ-123',
    details: { gateType: 'execution', passed: true },
  },
});

const createFailedResult = (): EvaluationPipelineResult => ({
  executionId: 'ep-test-failed-001',
  ticketKey: 'PROJ-456',
  gateType: 'execution',
  score: {
    overall: 45,
    axes: {
      clarity: 40,
      consistency: 50,
      risk: 30,
      documentation: 55,
      technicalDebt: 60,
    },
    timestamp: '2026-04-25T10:00:00.000Z',
    executionId: 'ep-test-failed-001',
  },
  inconsistencies: [
    {
      id: 'inc-001',
      type: 'contradiction',
      severity: 'critical',
      source: 'jira',
      description: 'Description contradicts acceptance criteria',
      affectedTicketKey: 'PROJ-456',
      suggestion: 'Review and align the description with ACs',
      relatedDocs: [],
    },
    {
      id: 'inc-002',
      type: 'missing_context',
      severity: 'warning',
      source: 'confluence',
      description: 'Missing documentation for API changes',
      affectedTicketKey: 'PROJ-456',
      suggestion: 'Add API documentation to the Confluence page',
      relatedDocs: ['doc-api-ref'],
    },
  ],
  gateResult: {
    gate: 'execution',
    passed: false,
    score: {
      overall: 45,
      axes: {
        clarity: 40,
        consistency: 50,
        risk: 30,
        documentation: 55,
        technicalDebt: 60,
      },
      timestamp: '2026-04-25T10:00:00.000Z',
      executionId: 'ep-test-failed-001',
    },
    inconsistencies: [],
    blockedTransitions: ['In Review'],
    executionId: 'ep-test-failed-001',
  },
  enforcementActions: [],
  auditEntry: {
    id: 'audit-test-002',
    action: 'gate_evaluated',
    timestamp: '2026-04-25T10:00:00.000Z',
    executionId: 'ep-test-failed-001',
    projectKey: 'PROJ',
    ticketKey: 'PROJ-456',
    details: { gateType: 'execution', passed: false },
  },
});

const createContext = (): RovoContext => ({
  documents: [
    {
      id: 'doc-1',
      title: 'API Reference Guide',
      content: 'Complete API documentation...',
      source: 'confluence',
      relevance: 0.95,
    },
    {
      id: 'doc-2',
      title: 'Architecture Decisions',
      content: 'ADR for microservices...',
      source: 'confluence',
      relevance: 0.8,
    },
  ],
  relatedTickets: ['PROJ-789', 'PROJ-101'],
  decisions: [
    {
      id: 'dec-1',
      title: 'Use REST over GraphQL',
      description: 'Team decision to use REST',
      date: '2026-03-15',
      source: 'confluence',
    },
  ],
  query: 'PROJ-123 context',
  timestamp: '2026-04-25T10:00:00.000Z',
});

const defaultConfig: CommentTemplateConfig = {
  showScoreBreakdown: true,
  showSuggestions: true,
  showRelatedTickets: true,
  showDocumentationLinks: true,
  showQuickActions: true,
};

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('pr-comment-formatter', () => {
  // ─── sanitizeMarkdown() ─────────────────

  describe('sanitizeMarkdown()', () => {
    it('should escape pipe characters (AC-05, SEC-PRIV-051)', () => {
      const result = sanitizeMarkdown('data | with | pipes');
      expect(result).toContain('\\|');
      expect(result).not.toBe('data | with | pipes');
    });

    it('should escape square brackets (AC-05, SEC-PRIV-051)', () => {
      const result = sanitizeMarkdown('text [link](url)');
      expect(result).not.toContain('[link]');
    });

    it('should escape backticks (AC-05, SEC-PRIV-051)', () => {
      const result = sanitizeMarkdown('code `injection` here');
      expect(result).not.toContain('`injection`');
    });

    it('should escape angle brackets (AC-05, SEC-PRIV-051)', () => {
      const result = sanitizeMarkdown('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
    });

    it('should truncate strings longer than 500 characters (AC-05, SEC-PRIV-008)', () => {
      const longInput = 'a'.repeat(600);
      const result = sanitizeMarkdown(longInput);
      expect(result.length).toBeLessThanOrEqual(510); // truncation marker + some slack
    });

    it('should return input unchanged if no special characters', () => {
      const input = 'Normal text without special chars 123';
      expect(sanitizeMarkdown(input)).toBe(input);
    });

    it('should handle empty string', () => {
      expect(sanitizeMarkdown('')).toBe('');
    });
  });

  // ─── formatPassedComment() ──────────────

  describe('formatPassedComment()', () => {
    it('should produce valid GFM with score table (AC-01, AC-02)', () => {
      const result = formatPassedComment(createPassedResult(), 'PROJ-123', defaultConfig);

      expect(result).toContain('##');
      expect(result).toContain('PROJ-123');
      expect(result).toContain('92');
      expect(result).toContain('Clarity');
      expect(result).toContain('Consistency');
      expect(result).toContain('Risk');
      expect(result).toContain('Documentation');
      expect(result).toContain('Technical Debt');
    });

    it('should include overall score and per-axis breakdown in a table (AC-02)', () => {
      const result = formatPassedComment(createPassedResult(), 'PROJ-123', defaultConfig);

      expect(result).toContain('|');
      expect(result).toContain('90');
      expect(result).toContain('95');
      expect(result).toContain('85');
      expect(result).toContain('88');
      expect(result).toContain('80');
    });

    it('should include clear-to-merge header (AC-01)', () => {
      const result = formatPassedComment(createPassedResult(), 'PROJ-123', defaultConfig);

      expect(result).toMatch(/clear.*merge|approved|passed/i);
    });

    it('should include collapsible details section (AC-01, UI-ADS-0862)', () => {
      const result = formatPassedComment(createPassedResult(), 'PROJ-123', defaultConfig);

      expect(result).toContain('<details>');
      expect(result).toContain('</details>');
    });

    it('should not contain sensitive data (AC-05, SEC-PRIV-002)', () => {
      const result = formatPassedComment(createPassedResult(), 'PROJ-123', defaultConfig);

      expect(result).not.toMatch(/token|secret|password|api[-_]?key/i);
      expect(result).not.toMatch(/ghp_|ghs_|github_pat_/);
      expect(result).not.toMatch(/webhook.*secret/i);
    });

    it('should respect showScoreBreakdown config (AC-06)', () => {
      const config: CommentTemplateConfig = {
        ...defaultConfig,
        showScoreBreakdown: false,
      };

      const result = formatPassedComment(createPassedResult(), 'PROJ-123', config);

      expect(result).not.toContain('Clarity');
      expect(result).not.toContain('Consistency');
    });

    it('should include custom header text when provided (AC-06)', () => {
      const config: CommentTemplateConfig = {
        ...defaultConfig,
        headerText: 'Custom Header',
      };

      const result = formatPassedComment(createPassedResult(), 'PROJ-123', config);

      expect(result).toContain('Custom Header');
    });

    it('should include custom footer text when provided (AC-06)', () => {
      const config: CommentTemplateConfig = {
        ...defaultConfig,
        footerText: 'Custom Footer',
      };

      const result = formatPassedComment(createPassedResult(), 'PROJ-123', config);

      expect(result).toContain('Custom Footer');
    });

    it('should handle score with overall=0 gracefully (AC-01, TEST-QA-057)', () => {
      const base = createPassedResult();
      const zeroResult: EvaluationPipelineResult = {
        ...base,
        score: {
          overall: 0,
          axes: { clarity: 0, consistency: 0, risk: 0, documentation: 0, technicalDebt: 0 },
          timestamp: '2026-04-25T10:00:00.000Z',
          executionId: 'ep-test-zero',
        },
      };

      const output = formatPassedComment(zeroResult, 'PROJ-123', defaultConfig);

      expect(output).toContain('0');
      expect(output).toBeDefined();
      expect(typeof output).toBe('string');
    });

    it('should use default config when no config provided', () => {
      const result = formatPassedComment(createPassedResult(), 'PROJ-123');

      expect(result).toContain('Clarity');
      expect(result).toContain('92');
    });
  });

  // ─── formatFailedComment() ──────────────

  describe('formatFailedComment()', () => {
    it('should produce valid GFM with reasons and suggestions (AC-01, AC-03)', () => {
      const result = formatFailedComment(createFailedResult(), 'PROJ-456', defaultConfig);

      expect(result).toContain('##');
      expect(result).toContain('PROJ-456');
      expect(result).toContain('Description contradicts acceptance criteria');
    });

    it('should show reasons with severity levels (AC-03, UI-ADS-0821)', () => {
      const result = formatFailedComment(createFailedResult(), 'PROJ-456', defaultConfig);

      expect(result).toMatch(/critical/i);
      expect(result).toMatch(/warning/i);
    });

    it('should format suggestions as checklist (AC-03, UI-ADS-0821)', () => {
      const result = formatFailedComment(createFailedResult(), 'PROJ-456', defaultConfig);

      expect(result).toContain('- [ ]');
      expect(result).toContain('Review and align the description with ACs');
    });

    it('should include score breakdown (AC-03)', () => {
      const result = formatFailedComment(createFailedResult(), 'PROJ-456', defaultConfig);

      expect(result).toContain('45');
      expect(result).toContain('|');
    });

    it('should include guidance to resolve (AC-03, UI-ADS-0821)', () => {
      const result = formatFailedComment(createFailedResult(), 'PROJ-456', defaultConfig);

      expect(result).toMatch(/resolve|re.?trigger|fix|address/i);
    });

    it('should not contain sensitive data (AC-05, SEC-PRIV-002)', () => {
      const result = formatFailedComment(createFailedResult(), 'PROJ-456', defaultConfig);

      expect(result).not.toMatch(/token|secret|password|api[-_]?key/i);
      expect(result).not.toMatch(/ghp_|ghs_|github_pat_/);
    });

    it('should respect showSuggestions config (AC-06)', () => {
      const config: CommentTemplateConfig = {
        ...defaultConfig,
        showSuggestions: false,
      };

      const result = formatFailedComment(createFailedResult(), 'PROJ-456', config);

      expect(result).not.toContain('- [ ]');
    });

    it('should respect showScoreBreakdown config (AC-06)', () => {
      const config: CommentTemplateConfig = {
        ...defaultConfig,
        showScoreBreakdown: false,
      };

      const result = formatFailedComment(createFailedResult(), 'PROJ-456', config);

      expect(result).not.toContain('Clarity');
    });

    it('should handle empty inconsistencies gracefully (AC-01, TEST-QA-057)', () => {
      const base = createFailedResult();
      const failedResult: EvaluationPipelineResult = { ...base, inconsistencies: [] };

      const result = formatFailedComment(failedResult, 'PROJ-456', defaultConfig);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle inconsistencies without suggestions (AC-03, TEST-QA-057)', () => {
      const base = createFailedResult();
      const noSuggestionResult: EvaluationPipelineResult = {
        ...base,
        inconsistencies: [
          {
            id: 'inc-no-sugg',
            type: 'contradiction',
            severity: 'critical',
            source: 'jira',
            description: 'Issue without suggestion',
            affectedTicketKey: 'PROJ-456',
            relatedDocs: [],
          },
        ],
      };

      const result = formatFailedComment(noSuggestionResult, 'PROJ-456', defaultConfig);

      expect(result).toBeDefined();
      expect(result).toContain('Issue without suggestion');
      expect(result).not.toContain('- [ ]');
    });

    it('should use default config when no config provided', () => {
      const result = formatFailedComment(createFailedResult(), 'PROJ-456');

      expect(result).toContain('- [ ]');
      expect(result).toContain('Clarity');
    });
  });

  // ─── formatContextComment() ──────────────

  describe('formatContextComment()', () => {
    it('should produce valid GFM with ticket links (AC-01, AC-04)', () => {
      const result = formatContextComment(createContext(), 'PROJ-123', defaultConfig);

      expect(result).toContain('##');
      expect(result).toContain('PROJ-123');
      expect(result).toContain('PROJ-789');
      expect(result).toContain('PROJ-101');
    });

    it('should include documentation links (AC-04)', () => {
      const result = formatContextComment(createContext(), 'PROJ-123', defaultConfig);

      expect(result).toContain('API Reference Guide');
      expect(result).toContain('Architecture Decisions');
    });

    it('should include quick actions (AC-04)', () => {
      const result = formatContextComment(createContext(), 'PROJ-123', defaultConfig);

      expect(result).toMatch(/re.?validat|view|panel/i);
    });

    it('should not contain sensitive data (AC-05, SEC-PRIV-002)', () => {
      const result = formatContextComment(createContext(), 'PROJ-123', defaultConfig);

      expect(result).not.toMatch(/token|secret|password|api[-_]?key/i);
    });

    it('should respect showRelatedTickets config (AC-06)', () => {
      const config: CommentTemplateConfig = {
        ...defaultConfig,
        showRelatedTickets: false,
      };

      const result = formatContextComment(createContext(), 'PROJ-123', config);

      expect(result).not.toContain('PROJ-789');
      expect(result).not.toContain('PROJ-101');
    });

    it('should respect showDocumentationLinks config (AC-06)', () => {
      const config: CommentTemplateConfig = {
        ...defaultConfig,
        showDocumentationLinks: false,
      };

      const result = formatContextComment(createContext(), 'PROJ-123', config);

      expect(result).not.toContain('API Reference Guide');
    });

    it('should handle empty documents and tickets (AC-04, TEST-QA-057)', () => {
      const emptyContext: RovoContext = {
        documents: [],
        relatedTickets: [],
        decisions: [],
        query: '',
        timestamp: '2026-04-25T10:00:00.000Z',
      };

      const result = formatContextComment(emptyContext, 'PROJ-123', defaultConfig);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should use default config when no config provided', () => {
      const result = formatContextComment(createContext(), 'PROJ-123');

      expect(result).toContain('PROJ-789');
      expect(result).toContain('API Reference Guide');
    });
  });

  // ─── Security & Sanitization Tests ──────

  describe('security & sanitization (AC-05, SEC-PRIV-002, SEC-PRIV-051, SEC-PRIV-0914)', () => {
    it('should sanitize malicious ticket key with markdown injection', () => {
      const base = createPassedResult();
      const maliciousResult: EvaluationPipelineResult = {
        ...base,
        ticketKey: 'PROJ-[123](http://evil.com)',
      };

      const result = formatPassedComment(maliciousResult, maliciousResult.ticketKey, defaultConfig);

      expect(result).not.toContain('[123](http://evil.com)');
    });

    it('should sanitize malicious description with pipe injection', () => {
      const base = createFailedResult();
      const maliciousResult: EvaluationPipelineResult = {
        ...base,
        inconsistencies: [
          {
            id: 'inc-evil',
            type: 'contradiction',
            severity: 'critical',
            source: 'jira',
            description: 'Evil | table | injection',
            affectedTicketKey: 'PROJ-123',
            suggestion: 'Fix | the | issue',
            relatedDocs: [],
          },
        ],
      };

      const result = formatFailedComment(maliciousResult, 'PROJ-123', defaultConfig);

      expect(result).not.toContain('Evil | table | injection');
    });

    it('should sanitize malicious document title with script tag', () => {
      const maliciousContext: RovoContext = {
        documents: [
          {
            id: 'doc-evil',
            title: '<script>alert("xss")</script>',
            content: '',
            source: 'confluence',
            relevance: 0.9,
          },
        ],
        relatedTickets: [],
        decisions: [],
        query: '',
        timestamp: '2026-04-25T10:00:00.000Z',
      };

      const result = formatContextComment(maliciousContext, 'PROJ-123', defaultConfig);

      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('should include executionId for traceability (not sensitive)', () => {
      const result = formatPassedComment(createPassedResult(), 'PROJ-123', defaultConfig);

      expect(result).toContain('ep-test-passed-001');
    });

    it('should handle ticket key with backtick injection', () => {
      const result = sanitizeMarkdown('PROJ-`whoami`');
      expect(result).not.toContain('`whoami`');
    });
  });

  // ─── Snapshot Tests ──────────────────────

  describe('snapshots (AC-01)', () => {
    it('should match snapshot for formatPassedComment', () => {
      const result = formatPassedComment(createPassedResult(), 'PROJ-123', defaultConfig);
      expect(result).toMatchSnapshot();
    });

    it('should match snapshot for formatFailedComment', () => {
      const result = formatFailedComment(createFailedResult(), 'PROJ-456', defaultConfig);
      expect(result).toMatchSnapshot();
    });

    it('should match snapshot for formatContextComment', () => {
      const result = formatContextComment(createContext(), 'PROJ-123', defaultConfig);
      expect(result).toMatchSnapshot();
    });
  });

  // ─── Pure Function Tests (ARCH-SOLID-069) ─

  describe('pure function behavior (ARCH-SOLID-069)', () => {
    it('should produce identical output for identical input', () => {
      const result1 = formatPassedComment(createPassedResult(), 'PROJ-123', defaultConfig);
      const result2 = formatPassedComment(createPassedResult(), 'PROJ-123', defaultConfig);

      expect(result1).toBe(result2);
    });

    it('should not mutate input objects', () => {
      const input = createPassedResult();
      const originalScore = input.score.overall;

      formatPassedComment(input, 'PROJ-123', defaultConfig);

      expect(input.score.overall).toBe(originalScore);
    });
  });
});
