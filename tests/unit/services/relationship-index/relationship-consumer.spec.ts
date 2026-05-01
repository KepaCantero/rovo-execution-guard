import {
  detectSiblingContradictions,
  detectSpecDrift,
  detectScopeMismatch,
  detectOrphanReferences,
  detectRelationshipInconsistencies,
  calculateDocumentationSignal,
  calculateConsistencySignal,
} from '../../../../src/backend/services/relationship-index/relationship-consumer';

import type {
  RelationshipContext,
  EntityNode,
  CrossReference,
} from '../../../../src/backend/types/relationship-index';

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const makeNode = (overrides: Partial<EntityNode> = {}): EntityNode => ({
  id: 'jira:PROJ-100',
  type: 'jira-issue',
  label: 'Implement Redis cache',
  status: 'In Progress',
  projectKey: 'PROJ',
  metadata: {},
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-04-15T00:00:00Z',
  ...overrides,
});

const makeContext = (overrides: Partial<RelationshipContext> = {}): RelationshipContext => ({
  siblings: [],
  documentation: [],
  pullRequests: [],
  topics: [],
  crossReferences: [],
  rankedItems: [],
  assembledAt: '2026-05-01T12:00:00Z',
  ...overrides,
});

const makeXref = (overrides: Partial<CrossReference> = {}): CrossReference => ({
  source: 'jira:PROJ-100',
  target: 'confluence:99999',
  sourceTool: 'jira',
  targetTool: 'confluence',
  referenceType: 'link',
  confidence: 0.8,
  ...overrides,
});

/** Safe array first-element access after length assertion. */
const first = <T>(arr: readonly T[]): T => {
  const item = arr[0];
  if (item === undefined) throw new Error('unexpected empty array');
  return item;
};

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('relationship-consumer', () => {
  // ─── detectSiblingContradictions() ──────

  describe('detectSiblingContradictions()', () => {
    it('should detect contradictions between ticket and sibling (AC-01)', () => {
      const ticketSummary = 'Must implement Redis cache for session storage';
      const ticketDescription = 'This is required for the migration';
      const siblings = [
        makeNode({
          id: 'jira:PROJ-101',
          label: 'Must not implement Redis — use Memcached instead',
        }),
      ];

      const result = detectSiblingContradictions(
        ticketSummary,
        ticketDescription,
        siblings,
        'PROJ-100',
      );

      expect(result.length).toBeGreaterThan(0);
      const inc = first(result);
      expect(inc.type).toBe('sibling_contradiction');
      expect(inc.affectedTicketKey).toBe('PROJ-100');
      expect(inc.source).toBe('rovo');
    });

    it('should return empty for no siblings (AC-01)', () => {
      const result = detectSiblingContradictions(
        'Some summary',
        'Some description',
        [],
        'PROJ-100',
      );

      expect(result).toEqual([]);
    });

    it('should return empty when siblings are aligned (AC-01)', () => {
      const siblings = [
        makeNode({ id: 'jira:PROJ-101', label: 'Also implement Redis cache for logging' }),
      ];

      const result = detectSiblingContradictions(
        'Implement Redis cache',
        'Required for migration',
        siblings,
        'PROJ-100',
      );

      expect(result).toEqual([]);
    });

    it('should escalate severity for multiple contradicting siblings (AC-01)', () => {
      const siblings = [
        makeNode({ id: 'jira:PROJ-101', label: 'Must not implement Redis' }),
        makeNode({ id: 'jira:PROJ-102', label: 'Should not implement Redis' }),
        makeNode({ id: 'jira:PROJ-103', label: 'Must not use Redis cache' }),
      ];

      const result = detectSiblingContradictions(
        'Must implement Redis cache',
        'Required',
        siblings,
        'PROJ-100',
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'critical')).toBe(true);
    });

    it('should set warning severity for single contradiction (AC-01)', () => {
      const siblings = [makeNode({ id: 'jira:PROJ-101', label: 'Must not use Redis' })];

      const result = detectSiblingContradictions(
        'Must use Redis cache',
        'Required',
        siblings,
        'PROJ-100',
      );

      expect(result.length).toBe(1);
      expect(first(result).severity).toBe('warning');
    });
  });

  // ─── detectSpecDrift() ─────────────────

  describe('detectSpecDrift()', () => {
    it('should detect warning drift when doc is >30 days older (AC-02)', () => {
      const docs = [
        makeNode({
          id: 'confluence:99999',
          type: 'confluence-page',
          label: 'Cache Migration Spec',
          updatedAt: '2026-02-15T00:00:00Z',
        }),
      ];

      const result = detectSpecDrift(docs, '2026-05-01T00:00:00Z', 'PROJ-100');

      expect(result.length).toBe(1);
      const inc = first(result);
      expect(inc.type).toBe('spec_drift');
      expect(inc.severity).toBe('warning');
    });

    it('should detect critical drift when doc is >90 days older (AC-02)', () => {
      const docs = [
        makeNode({
          id: 'confluence:99999',
          type: 'confluence-page',
          label: 'Old Spec',
          updatedAt: '2025-12-01T00:00:00Z',
        }),
      ];

      const result = detectSpecDrift(docs, '2026-05-01T00:00:00Z', 'PROJ-100');

      expect(result.length).toBe(1);
      expect(first(result).severity).toBe('critical');
    });

    it('should return empty for fresh documentation (AC-02)', () => {
      const docs = [
        makeNode({
          id: 'confluence:99999',
          type: 'confluence-page',
          label: 'Fresh Spec',
          updatedAt: '2026-04-20T00:00:00Z',
        }),
      ];

      const result = detectSpecDrift(docs, '2026-05-01T00:00:00Z', 'PROJ-100');

      expect(result).toEqual([]);
    });

    it('should return empty for no documentation (AC-02)', () => {
      const result = detectSpecDrift([], '2026-05-01T00:00:00Z', 'PROJ-100');

      expect(result).toEqual([]);
    });

    it('should detect drift for multiple stale docs (AC-02)', () => {
      const docs = [
        makeNode({
          id: 'confluence:1',
          type: 'confluence-page',
          label: 'Spec A',
          updatedAt: '2026-02-01T00:00:00Z',
        }),
        makeNode({
          id: 'confluence:2',
          type: 'confluence-page',
          label: 'Spec B',
          updatedAt: '2026-03-20T00:00:00Z',
        }),
      ];

      const result = detectSpecDrift(docs, '2026-05-01T00:00:00Z', 'PROJ-100');

      expect(result.length).toBe(2);
    });
  });

  // ─── detectScopeMismatch() ─────────────

  describe('detectScopeMismatch()', () => {
    it('should detect scope mismatch for PR with excessive file changes (AC-03)', () => {
      const prs = [
        makeNode({
          id: 'github:org/repo/pull/42',
          type: 'github-pr',
          label: 'Implement cache migration',
          metadata: { fileCount: '30', linkedIssues: 'PROJ-100' },
        }),
      ];

      const result = detectScopeMismatch(prs, 'PROJ-100', 'Implement cache migration');

      expect(result.length).toBeGreaterThan(0);
      expect(first(result).type).toBe('scope_mismatch');
    });

    it('should return empty for small, well-scoped PRs (AC-03)', () => {
      const prs = [
        makeNode({
          id: 'github:org/repo/pull/42',
          type: 'github-pr',
          label: 'Implement cache migration',
          metadata: { fileCount: '5', linkedIssues: 'PROJ-100' },
        }),
      ];

      const result = detectScopeMismatch(prs, 'PROJ-100', 'Implement cache migration');

      expect(result).toEqual([]);
    });

    it('should return empty for no PRs (AC-03)', () => {
      const result = detectScopeMismatch([], 'PROJ-100', 'Implement cache migration');

      expect(result).toEqual([]);
    });

    it('should detect unlinked PR (AC-03)', () => {
      const prs = [
        makeNode({
          id: 'github:org/repo/pull/99',
          type: 'github-pr',
          label: 'Random changes',
          metadata: { fileCount: '3' },
        }),
      ];

      const result = detectScopeMismatch(prs, 'PROJ-100', 'Implement cache migration');

      expect(result.length).toBeGreaterThan(0);
      expect(first(result).type).toBe('scope_mismatch');
    });
  });

  // ─── detectOrphanReferences() ──────────

  describe('detectOrphanReferences()', () => {
    it('should detect low-confidence cross-references (AC-04)', () => {
      const xrefs = [makeXref({ confidence: 0.2, referenceType: 'keyword' })];

      const result = detectOrphanReferences(xrefs, 'PROJ-100');

      expect(result.length).toBeGreaterThan(0);
      const inc = first(result);
      expect(inc.type).toBe('orphan_reference');
      expect(inc.severity).toBe('info');
    });

    it('should return empty for high-confidence cross-references (AC-04)', () => {
      const xrefs = [makeXref({ confidence: 0.8 })];

      const result = detectOrphanReferences(xrefs, 'PROJ-100');

      expect(result).toEqual([]);
    });

    it('should return empty for no cross-references (AC-04)', () => {
      const result = detectOrphanReferences([], 'PROJ-100');

      expect(result).toEqual([]);
    });

    it('should detect moderate-confidence mention cross-references (AC-04)', () => {
      const xrefs = [
        makeXref({
          source: 'jira:PROJ-100',
          target: 'github:org/repo/pull/999',
          confidence: 0.6,
          referenceType: 'mention',
        }),
      ];

      const result = detectOrphanReferences(xrefs, 'PROJ-100');

      expect(result.length).toBeGreaterThan(0);
      expect(first(result).severity).toBe('warning');
    });
  });

  // ─── detectRelationshipInconsistencies() ─

  describe('detectRelationshipInconsistencies()', () => {
    it('should aggregate all detectors (AC-05)', () => {
      const context = makeContext({
        siblings: [makeNode({ id: 'jira:PROJ-101', label: 'Must not use Redis' })],
        documentation: [
          makeNode({
            id: 'confluence:1',
            type: 'confluence-page',
            label: 'Stale spec',
            updatedAt: '2026-01-01T00:00:00Z',
          }),
        ],
      });

      const result = detectRelationshipInconsistencies(
        context,
        'Must use Redis cache',
        'Required for migration',
        '2026-05-01T00:00:00Z',
        'PROJ-100',
      );

      expect(result.length).toBeGreaterThanOrEqual(2);
      const types = new Set(result.map((r) => r.type));
      expect(types.has('sibling_contradiction')).toBe(true);
      expect(types.has('spec_drift')).toBe(true);
    });

    it('should return empty for empty context (AC-05)', () => {
      const context = makeContext();

      const result = detectRelationshipInconsistencies(
        context,
        'summary',
        'description',
        '2026-05-01T00:00:00Z',
        'PROJ-100',
      );

      expect(result).toEqual([]);
    });

    it('should produce multiple results for multiple stale docs (AC-05)', () => {
      const context = makeContext({
        documentation: [
          makeNode({
            id: 'confluence:1',
            type: 'confluence-page',
            label: 'Stale A',
            updatedAt: '2026-01-01T00:00:00Z',
          }),
          makeNode({
            id: 'confluence:2',
            type: 'confluence-page',
            label: 'Stale B',
            updatedAt: '2026-01-01T00:00:00Z',
          }),
        ],
      });

      const result = detectRelationshipInconsistencies(
        context,
        'summary',
        'desc',
        '2026-05-01T00:00:00Z',
        'PROJ-100',
      );

      expect(result.length).toBe(2);
      expect(result.every((r) => r.type === 'spec_drift')).toBe(true);
    });
  });

  // ─── calculateDocumentationSignal() ────

  describe('calculateDocumentationSignal()', () => {
    it('should give bonus for fresh documentation (AC-06)', () => {
      const context = makeContext({
        documentation: [
          makeNode({
            id: 'confluence:1',
            type: 'confluence-page',
            label: 'Fresh Spec',
            updatedAt: '2026-04-25T00:00:00Z',
          }),
        ],
      });

      const result = calculateDocumentationSignal(context);

      expect(result.bonus).toBeGreaterThan(0);
      expect(result.penalty).toBe(0);
      expect(result.signals.length).toBeGreaterThan(0);
    });

    it('should give penalty for stale documentation (AC-06)', () => {
      const context = makeContext({
        documentation: [
          makeNode({
            id: 'confluence:1',
            type: 'confluence-page',
            label: 'Stale Spec',
            updatedAt: '2026-01-01T00:00:00Z',
          }),
        ],
      });

      const result = calculateDocumentationSignal(context);

      expect(result.penalty).toBeLessThan(0);
      expect(result.signals.some((s) => s.toLowerCase().includes('stale'))).toBe(true);
    });

    it('should give no bonus or penalty for no documentation (AC-06)', () => {
      const context = makeContext();

      const result = calculateDocumentationSignal(context);

      expect(result.bonus).toBe(0);
      expect(result.penalty).toBe(0);
    });

    it('should cap bonus at +20 (AC-06)', () => {
      const context = makeContext({
        documentation: Array.from({ length: 10 }, (_, i) =>
          makeNode({
            id: `confluence:${i}`,
            type: 'confluence-page',
            label: `Fresh Spec ${i}`,
            updatedAt: '2026-04-28T00:00:00Z',
          }),
        ),
      });

      const result = calculateDocumentationSignal(context);

      expect(result.bonus).toBeLessThanOrEqual(20);
    });

    it('should cap penalty at -15 (AC-06)', () => {
      const context = makeContext({
        documentation: Array.from({ length: 10 }, (_, i) =>
          makeNode({
            id: `confluence:${i}`,
            type: 'confluence-page',
            label: `Stale Spec ${i}`,
            updatedAt: '2025-06-01T00:00:00Z',
          }),
        ),
      });

      const result = calculateDocumentationSignal(context);

      expect(result.penalty).toBeGreaterThanOrEqual(-15);
    });
  });

  // ─── calculateConsistencySignal() ──────

  describe('calculateConsistencySignal()', () => {
    it('should give bonus for aligned siblings (AC-07)', () => {
      const context = makeContext({
        siblings: [
          makeNode({ id: 'jira:PROJ-101', label: 'Also implement Redis cache for logging' }),
          makeNode({ id: 'jira:PROJ-102', label: 'Implement Redis cache for sessions' }),
        ],
      });

      const result = calculateConsistencySignal(context);

      expect(result.bonus).toBeGreaterThan(0);
      expect(result.penalty).toBe(0);
    });

    it('should give penalty for contradicting siblings (AC-07)', () => {
      const context = makeContext({
        siblings: [makeNode({ id: 'jira:PROJ-101', label: 'Must not use Redis' })],
      });

      const result = calculateConsistencySignal(context, 'Must use Redis');

      expect(result.penalty).toBeLessThan(0);
      expect(result.signals.some((s) => s.toLowerCase().includes('contradict'))).toBe(true);
    });

    it('should give no bonus or penalty for no siblings (AC-07)', () => {
      const context = makeContext();

      const result = calculateConsistencySignal(context);

      expect(result.bonus).toBe(0);
      expect(result.penalty).toBe(0);
    });

    it('should cap bonus at +15 (AC-07)', () => {
      const context = makeContext({
        siblings: Array.from({ length: 10 }, (_, i) =>
          makeNode({ id: `jira:PROJ-${101 + i}`, label: `Also implement Redis cache part ${i}` }),
        ),
      });

      const result = calculateConsistencySignal(context);

      expect(result.bonus).toBeLessThanOrEqual(15);
    });

    it('should cap penalty at -20 (AC-07)', () => {
      const context = makeContext({
        siblings: Array.from({ length: 10 }, (_, i) =>
          makeNode({ id: `jira:PROJ-${101 + i}`, label: `Must not use Redis ${i}` }),
        ),
      });

      const result = calculateConsistencySignal(context, 'Must use Redis');

      expect(result.penalty).toBeGreaterThanOrEqual(-20);
    });
  });

  // ─── RULEBOOK Compliance ───────────────

  describe('RULEBOOK Compliance', () => {
    it('should be deterministic — same input produces same output (AC-09, ARCH-SOLID-0912)', () => {
      const context = makeContext({
        siblings: [makeNode({ id: 'jira:PROJ-101', label: 'Must not implement Redis' })],
      });

      const result1 = detectRelationshipInconsistencies(
        context,
        'Must implement Redis',
        'Required',
        '2026-05-01T00:00:00Z',
        'PROJ-100',
      );
      const result2 = detectRelationshipInconsistencies(
        context,
        'Must implement Redis',
        'Required',
        '2026-05-01T00:00:00Z',
        'PROJ-100',
      );

      expect(result1).toEqual(result2);
    });

    it('should produce consistent Inconsistency objects with all required fields (AC-08)', () => {
      const context = makeContext({
        siblings: [makeNode({ id: 'jira:PROJ-101', label: 'Must not implement Redis' })],
      });

      const result = detectRelationshipInconsistencies(
        context,
        'Must implement Redis',
        'Required',
        '2026-05-01T00:00:00Z',
        'PROJ-100',
      );

      for (const inc of result) {
        expect(inc.id).toBeDefined();
        expect(inc.type).toBeDefined();
        expect(inc.severity).toBeDefined();
        expect(inc.source).toBeDefined();
        expect(inc.description).toBeDefined();
        expect(inc.affectedTicketKey).toBe('PROJ-100');
      }
    });
  });
});
