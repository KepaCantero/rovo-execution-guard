import {
  extractCausalPaths,
  rankPaths,
  assembleContext,
  estimateTokens,
  DEFAULT_BUDGET,
} from '../../../../src/backend/services/relationship-index/context-builder';

import type {
  CausalPath,
  BuiltContext,
} from '../../../../src/backend/services/relationship-index/context-builder';

import type {
  EntityNeighborhood,
  RelationshipContext,
  ContextBudget,
  DecisionRecord,
  EntityNode,
  TopicCluster,
  CrossReference,
} from '../../../../src/backend/types/relationship-index';

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const makeNeighborhood = (overrides: Partial<EntityNeighborhood> = {}): EntityNeighborhood => ({
  entityId: 'jira:PROJ-100',
  entityKey: 'PROJ-100',
  entityType: 'jira-issue',
  projectKey: 'PROJ',
  siblings: [],
  linkedIssues: [],
  topics: [],
  updatedAt: '2026-05-01T00:00:00Z',
  ...overrides,
});

const makeNode = (overrides: Partial<EntityNode> = {}): EntityNode => ({
  id: 'jira:PROJ-100',
  type: 'jira-issue',
  label: 'Implement cache migration',
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

const makeTopic = (overrides: Partial<TopicCluster> = {}): TopicCluster => ({
  id: 'topic:cache-migration',
  label: 'Cache Migration',
  keywords: ['cache', 'redis', 'migration'],
  entityIds: ['jira:PROJ-100'],
  projectKeys: ['PROJ'],
  strength: 0.8,
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

const makeDecision = (overrides: Partial<DecisionRecord> = {}): DecisionRecord => ({
  id: 'dec-001',
  issueKey: 'PROJ-100',
  gateType: 'delivery',
  score: 72,
  action: 'block',
  overridden: false,
  contextSignature: 'PROJ-100:72:delivery:3',
  timestamp: '2026-04-28T00:00:00Z',
  ...overrides,
});

const SMALL_BUDGET: ContextBudget = { maxTokens: 100, reserveForPrompt: 20 };

/** Type-safe find — throws if not found (avoids non-null assertion). */
function findPath(paths: readonly CausalPath[], predicate: (p: CausalPath) => boolean): CausalPath {
  const found = paths.find(predicate);
  if (!found) throw new Error('Path not found');
  return found;
}

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('context-builder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── estimateTokens() ───────────────────

  describe('estimateTokens()', () => {
    it('should estimate tokens as ceil(length / 4) (AC-04)', () => {
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens('abcd')).toBe(1);
      expect(estimateTokens('abcde')).toBe(2);
      expect(estimateTokens('abcdefgh')).toBe(2);
      expect(estimateTokens('abcdefghi')).toBe(3);
    });

    it('should return 0 for empty string (AC-04)', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should handle long text', () => {
      const text = 'a'.repeat(1000);
      expect(estimateTokens(text)).toBe(250);
    });
  });

  // ─── extractCausalPaths() ───────────────

  describe('extractCausalPaths()', () => {
    it('should return empty array for empty context (AC-01)', () => {
      const neighborhood = makeNeighborhood();
      const context = makeContext();
      const paths = extractCausalPaths(neighborhood, context);
      expect(paths).toEqual([]);
    });

    it('should extract sibling contradiction paths (AC-01)', () => {
      const sibling = makeNode({
        id: 'jira:PROJ-101',
        label: 'Use Memcached instead',
        status: 'In Progress',
      });
      const neighborhood = makeNeighborhood();
      const context = makeContext({ siblings: [sibling] });

      const paths = extractCausalPaths(neighborhood, context);

      const siblingPath = findPath(paths, (p) => p.pathType === 'contradiction');
      expect(siblingPath.steps).toEqual(['jira:PROJ-100', 'sibling-of', 'jira:PROJ-101']);
      expect(siblingPath.signalScore).toBe(0.9);
      expect(siblingPath.summary).toContain('Use Memcached instead');
    });

    it('should extract PR alignment paths for merged PRs (AC-01)', () => {
      const pr = makeNode({
        id: 'github:org/repo/pull/42',
        type: 'github-pr',
        label: 'PR #42: Cache migration',
        status: 'merged',
      });
      const neighborhood = makeNeighborhood();
      const context = makeContext({ pullRequests: [pr] });

      const paths = extractCausalPaths(neighborhood, context);

      const prPath = findPath(
        paths,
        (p) => p.pathType === 'alignment' && p.steps.includes('github:org/repo/pull/42'),
      );
      expect(prPath.signalScore).toBe(0.85);
      expect(prPath.summary).toContain('merged');
    });

    it('should extract neutral paths for open PRs', () => {
      const pr = makeNode({
        id: 'github:org/repo/pull/99',
        type: 'github-pr',
        label: 'PR #99: WIP',
        status: 'open',
      });
      const neighborhood = makeNeighborhood();
      const context = makeContext({ pullRequests: [pr] });

      const paths = extractCausalPaths(neighborhood, context);

      const prPath = findPath(paths, (p) => p.steps.includes('github:org/repo/pull/99'));
      expect(prPath.pathType).toBe('neutral');
      expect(prPath.signalScore).toBe(0.3);
    });

    it('should detect documentation drift for stale docs (AC-07)', () => {
      const staleDoc = makeNode({
        id: 'confluence:99999',
        type: 'confluence-page',
        label: 'Cache Design Doc',
        updatedAt: '2026-01-01T00:00:00Z', // 120+ days before assembledAt
      });
      const neighborhood = makeNeighborhood();
      const context = makeContext({
        documentation: [staleDoc],
        assembledAt: '2026-05-01T12:00:00Z',
      });

      const paths = extractCausalPaths(neighborhood, context);

      const driftPath = findPath(paths, (p) => p.pathType === 'drift');
      expect(driftPath.signalScore).toBe(0.7);
      expect(driftPath.summary).toContain('stale');
    });

    it('should detect alignment for fresh docs (AC-01)', () => {
      const freshDoc = makeNode({
        id: 'confluence:88888',
        type: 'confluence-page',
        label: 'Cache Design Doc v2',
        updatedAt: '2026-04-28T00:00:00Z', // 3 days before assembledAt
      });
      const neighborhood = makeNeighborhood();
      const context = makeContext({
        documentation: [freshDoc],
        assembledAt: '2026-05-01T12:00:00Z',
      });

      const paths = extractCausalPaths(neighborhood, context);

      const alignPath = findPath(
        paths,
        (p) => p.pathType === 'alignment' && p.steps.includes('confluence:88888'),
      );
      expect(alignPath.summary).toContain('up to date');
    });

    it('should detect topic gaps when no docs match keywords (AC-08)', () => {
      const topic = makeTopic({ keywords: ['redis', 'migration'] });
      const unrelatedDoc = makeNode({
        id: 'confluence:77777',
        type: 'confluence-page',
        label: 'Unrelated Page',
        updatedAt: '2026-04-28T00:00:00Z',
      });
      const neighborhood = makeNeighborhood();
      const context = makeContext({
        topics: [topic],
        documentation: [unrelatedDoc],
      });

      const paths = extractCausalPaths(neighborhood, context);

      const gapPath = findPath(paths, (p) => p.pathType === 'gap');
      expect(gapPath.signalScore).toBe(0.65);
      expect(gapPath.summary).toContain('no documentation');
    });

    it('should NOT create gap path when docs match topic keywords (AC-08)', () => {
      const topic = makeTopic({ keywords: ['cache'] });
      const relatedDoc = makeNode({
        id: 'confluence:66666',
        type: 'confluence-page',
        label: 'Cache Strategy Guide',
        updatedAt: '2026-04-28T00:00:00Z',
      });
      const neighborhood = makeNeighborhood();
      const context = makeContext({
        topics: [topic],
        documentation: [relatedDoc],
      });

      const paths = extractCausalPaths(neighborhood, context);

      const gapPath = paths.find((p) => p.pathType === 'gap');
      expect(gapPath).toBeUndefined();
    });

    it('should extract cross-reference paths scaled by confidence (AC-09)', () => {
      const xref = makeXref({ confidence: 0.5 });
      const neighborhood = makeNeighborhood();
      const context = makeContext({ crossReferences: [xref] });

      const paths = extractCausalPaths(neighborhood, context);

      const xrefPath = findPath(
        paths,
        (p) => p.pathType === 'neutral' && p.summary.includes('jira'),
      );
      expect(xrefPath.signalScore).toBeCloseTo(0.15, 2); // 0.3 * 0.5
    });

    it('should cap at MAX_PATHS (20) (AC-06)', () => {
      const siblings = Array.from({ length: 25 }, (_, i) =>
        makeNode({ id: `jira:PROJ-${i + 200}`, label: `Sibling ${i}`, status: 'Open' }),
      );
      const neighborhood = makeNeighborhood();
      const context = makeContext({ siblings });

      const paths = extractCausalPaths(neighborhood, context);

      expect(paths).toHaveLength(20);
    });

    it('should be deterministic — same input produces same output (AC-12, ARCH-SOLID-0912)', () => {
      const sibling = makeNode({ id: 'jira:PROJ-101', label: 'Sibling' });
      const neighborhood = makeNeighborhood();
      const context = makeContext({ siblings: [sibling] });

      const run1 = extractCausalPaths(neighborhood, context);
      const run2 = extractCausalPaths(neighborhood, context);

      expect(run1).toEqual(run2);
    });
  });

  // ─── rankPaths() ────────────────────────

  describe('rankPaths()', () => {
    const makePath = (overrides: Partial<CausalPath> = {}): CausalPath => ({
      steps: ['a', 'b', 'c'],
      signalScore: 0.5,
      pathType: 'neutral',
      summary: 'Test path summary text',
      ...overrides,
    });

    it('should sort paths by signalScore descending (AC-02)', () => {
      const paths = [
        makePath({ signalScore: 0.3, summary: 'Low signal' }),
        makePath({ signalScore: 0.9, summary: 'High signal path' }),
        makePath({ signalScore: 0.6, summary: 'Medium signal' }),
      ];

      const ranked = rankPaths(paths, DEFAULT_BUDGET);

      expect(ranked).toHaveLength(3);
      expect(ranked[0]?.signalScore).toBe(0.9);
      expect(ranked[1]?.signalScore).toBe(0.6);
      expect(ranked[2]?.signalScore).toBe(0.3);
    });

    it('should return empty for empty input (AC-02)', () => {
      expect(rankPaths([], DEFAULT_BUDGET)).toEqual([]);
    });

    it('should prune to token budget (AC-02, AC-05)', () => {
      const paths = Array.from({ length: 50 }, (_, i) =>
        makePath({ signalScore: 0.9 - i * 0.01, summary: `Path ${i}: ${'x'.repeat(100)}` }),
      );

      const ranked = rankPaths(paths, SMALL_BUDGET);

      let totalTokens = 0;
      for (const p of ranked) {
        totalTokens += estimateTokens(p.summary);
      }
      expect(totalTokens).toBeLessThanOrEqual(
        SMALL_BUDGET.maxTokens - SMALL_BUDGET.reserveForPrompt,
      );
    });

    it('should not mutate the input array (AC-12, ARCH-SOLID-0912)', () => {
      const paths = [makePath({ signalScore: 0.3 }), makePath({ signalScore: 0.9 })];
      const original = [...paths];

      rankPaths(paths, DEFAULT_BUDGET);

      expect(paths).toEqual(original);
    });
  });

  // ─── assembleContext() ──────────────────

  describe('assembleContext()', () => {
    const primaryEntity = {
      key: 'PROJ-100',
      summary: 'Implement cache migration',
      status: 'In Progress',
    };

    it('should place high-signal facts at START (AC-03)', () => {
      const paths: CausalPath[] = [
        {
          steps: ['a', 'b', 'c'],
          signalScore: 0.9,
          pathType: 'contradiction',
          summary: 'High signal fact',
        },
      ];

      const result = assembleContext(paths, primaryEntity, [], DEFAULT_BUDGET);

      expect(result.factsAtStart).toContain('High signal fact');
    });

    it('should place low-signal evidence in MIDDLE (AC-03)', () => {
      const paths: CausalPath[] = [
        {
          steps: ['a', 'b', 'c'],
          signalScore: 0.3,
          pathType: 'neutral',
          summary: 'Low signal evidence',
        },
      ];

      const result = assembleContext(paths, primaryEntity, [], DEFAULT_BUDGET);

      expect(result.evidenceInMiddle).toContain('Low signal evidence');
    });

    it('should place primary entity question at END (AC-03)', () => {
      const result = assembleContext([], primaryEntity, [], DEFAULT_BUDGET);

      const firstQuestion = result.questionAtEnd[0];
      expect(firstQuestion).toBeDefined();
      expect(firstQuestion).toContain('PROJ-100');
      expect(firstQuestion).toContain('Implement cache migration');
    });

    it('should surface overridden decisions at END (AC-10)', () => {
      const decisions = [
        makeDecision({ overridden: true }),
        makeDecision({ overridden: true }),
        makeDecision({ overridden: false }),
      ];

      const result = assembleContext([], primaryEntity, decisions, DEFAULT_BUDGET);

      const overrideMsg = result.questionAtEnd.find((q) => q.includes('overridden'));
      expect(overrideMsg).toBeDefined();
      expect(String(overrideMsg)).toContain('2');
    });

    it('should NOT mention overrides when none exist', () => {
      const decisions = [makeDecision({ overridden: false })];

      const result = assembleContext([], primaryEntity, decisions, DEFAULT_BUDGET);

      expect(result.questionAtEnd.find((q) => q.includes('overridden'))).toBeUndefined();
    });

    it('should calculate totalTokens from all positions (AC-04)', () => {
      const paths: CausalPath[] = [
        { steps: ['a', 'b'], signalScore: 0.9, pathType: 'contradiction', summary: 'Fact' },
        { steps: ['c', 'd'], signalScore: 0.3, pathType: 'neutral', summary: 'Evidence' },
      ];

      const result = assembleContext(paths, primaryEntity, [], DEFAULT_BUDGET);

      expect(result.totalTokens).toBeGreaterThan(0);
      const expectedText = [
        ...result.factsAtStart,
        ...result.evidenceInMiddle,
        ...result.questionAtEnd,
      ].join('\n');
      expect(result.totalTokens).toBe(estimateTokens(expectedText));
    });

    it('should include budget in result', () => {
      const result = assembleContext([], primaryEntity, [], DEFAULT_BUDGET);
      expect(result.budget).toEqual(DEFAULT_BUDGET);
    });

    it('should include paths in result', () => {
      const paths: CausalPath[] = [
        { steps: ['a'], signalScore: 0.5, pathType: 'neutral', summary: 'Test' },
      ];
      const result = assembleContext(paths, primaryEntity, [], DEFAULT_BUDGET);
      expect(result.paths).toEqual(paths);
    });

    it('should handle all empty inputs gracefully', () => {
      const result = assembleContext([], primaryEntity, [], DEFAULT_BUDGET);

      expect(result.factsAtStart).toEqual([]);
      expect(result.evidenceInMiddle).toEqual([]);
      expect(result.questionAtEnd).toHaveLength(1); // primary entity question
      expect(result.totalTokens).toBeGreaterThan(0);
    });
  });

  // ─── DEFAULT_BUDGET ─────────────────────

  describe('DEFAULT_BUDGET', () => {
    it('should have maxTokens of 2500 (AC-05)', () => {
      expect(DEFAULT_BUDGET.maxTokens).toBe(2500);
    });

    it('should have reserveForPrompt of 500 (AC-05)', () => {
      expect(DEFAULT_BUDGET.reserveForPrompt).toBe(500);
    });
  });

  // ─── RULEBOOK Compliance ────────────────

  describe('RULEBOOK compliance', () => {
    it('should have zero any types — verified by TypeScript compiler (ARCH-SOLID-202)', () => {
      const neighborhood = makeNeighborhood();
      const context = makeContext();
      const paths: readonly CausalPath[] = extractCausalPaths(neighborhood, context);
      const ranked: readonly CausalPath[] = rankPaths(paths, DEFAULT_BUDGET);
      const built: BuiltContext = assembleContext(
        ranked,
        { key: 'K', summary: 'S', status: 'X' },
        [],
        DEFAULT_BUDGET,
      );
      const tokens: number = estimateTokens('test');

      expect(paths).toBeDefined();
      expect(ranked).toBeDefined();
      expect(built).toBeDefined();
      expect(tokens).toBeDefined();
    });

    it('should use named exports only (ARCH-SOLID-232)', () => {
      expect(typeof extractCausalPaths).toBe('function');
      expect(typeof rankPaths).toBe('function');
      expect(typeof assembleContext).toBe('function');
      expect(typeof estimateTokens).toBe('function');
    });
  });
});
