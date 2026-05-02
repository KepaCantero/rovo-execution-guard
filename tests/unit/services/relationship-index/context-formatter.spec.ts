import {
  formatRelationshipContext,
  formatSiblings,
  formatDocumentation,
  formatPullRequests,
  formatTopics,
  formatCrossReferences,
  buildActionContext,
  buildPathContext,
  buildEvolvingPrompt,
} from '../../../../src/backend/services/relationship-index/context-formatter';

import type {
  EntityNode,
  TopicCluster,
  CrossReference,
  RelationshipContext,
  DecisionRecord,
  ContextBudget,
} from '../../../../src/backend/types/relationship-index';

import type { CausalPath } from '../../../../src/backend/services/relationship-index/context-builder';

/** Matches the private estimateTokens in context-formatter (1 token ≈ 4 chars). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const makeEntity = (overrides: Partial<EntityNode> = {}): EntityNode => ({
  id: 'jira:PROJ-101',
  type: 'jira-issue',
  label: 'Migrate login to OAuth2',
  status: 'In Progress',
  projectKey: 'PROJ',
  metadata: {},
  createdAt: '2026-04-01T10:00:00Z',
  updatedAt: '2026-04-28T10:00:00Z',
  ...overrides,
});

const makeSibling = (id: string, label: string, status: string): EntityNode =>
  makeEntity({ id: `jira:${id}`, label, status });

const makeDoc = (label: string, relevance: string, pageType: string): EntityNode =>
  makeEntity({
    id: `confluence:12345`,
    type: 'confluence-page',
    label,
    metadata: { relevance, pageType },
    updatedAt: '2026-04-28T10:00:00Z',
  });

const makePr = (
  number: string,
  label: string,
  status: string,
  files: string,
  repo: string,
): EntityNode =>
  makeEntity({
    id: 'github:owner/repo/pull/42',
    type: 'github-pr',
    label,
    status,
    metadata: { number, files, repo },
  });

const makeTopic = (label: string, strength: number, entityCount: number): TopicCluster => ({
  id: `topic:${label}`,
  label,
  keywords: [label],
  entityIds: Array.from({ length: entityCount }, (_, i) => `entity-${i}`),
  projectKeys: ['PROJ'],
  strength,
});

const makeXref = (
  source: string,
  target: string,
  sourceTool: 'jira' | 'confluence' | 'github',
  targetTool: 'jira' | 'confluence' | 'github',
  referenceType: CrossReference['referenceType'],
  confidence: number,
): CrossReference => ({
  source,
  target,
  sourceTool,
  targetTool,
  referenceType,
  confidence,
});

const makeContext = (overrides: Partial<RelationshipContext> = {}): RelationshipContext => ({
  siblings: [],
  documentation: [],
  pullRequests: [],
  topics: [],
  crossReferences: [],
  rankedItems: [],
  assembledAt: '2026-05-01T10:00:00Z',
  ...overrides,
});

const makePath = (
  pathType: CausalPath['pathType'],
  signalScore: number,
  summary: string,
): CausalPath => ({
  steps: ['a', 'b'],
  signalScore,
  pathType,
  summary,
});

const makeDecision = (overrides: Partial<DecisionRecord> = {}): DecisionRecord => ({
  id: 'dec-1',
  issueKey: 'PROJ-100',
  gateType: 'block',
  score: 45,
  action: 'block',
  overridden: false,
  contextSignature: 'PROJ-100:block:45',
  timestamp: '2026-05-01T10:00:00Z',
  ...overrides,
});

const BUDGET: ContextBudget = { maxTokens: 2000, reserveForPrompt: 500 };

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('context-formatter', () => {
  // ─── formatSiblings() ───────────────────

  describe('formatSiblings()', () => {
    it('returns empty string for empty array', () => {
      expect(formatSiblings([])).toBe('');
    });

    it('formats a single sibling', () => {
      const siblings = [makeSibling('PROJ-101', 'Add OAuth2', 'In Progress')];
      const result = formatSiblings(siblings);
      expect(result).toBe('- Add OAuth2 (In Progress)');
    });

    it('formats multiple siblings as bullet list', () => {
      const siblings = [
        makeSibling('PROJ-101', 'Add OAuth2', 'In Progress'),
        makeSibling('PROJ-102', 'Add session timeout', 'Done'),
      ];
      const result = formatSiblings(siblings);
      expect(result).toContain('- Add OAuth2 (In Progress)');
      expect(result).toContain('- Add session timeout (Done)');
      expect(result.split('\n')).toHaveLength(2);
    });
  });

  // ─── formatDocumentation() ─────────────

  describe('formatDocumentation()', () => {
    it('returns empty string for empty array', () => {
      expect(formatDocumentation([])).toBe('');
    });

    it('formats doc with relevance and page type', () => {
      const docs = [makeDoc('Auth Architecture', '0.92', 'SPEC')];
      const result = formatDocumentation(docs);
      expect(result).toContain('"Auth Architecture"');
      expect(result).toContain('relevance: 0.92');
      expect(result).toContain('SPEC');
      expect(result).toContain('updated 2026-04-28');
    });

    it('uses unknown for missing metadata', () => {
      const docs = [makeEntity({ type: 'confluence-page', label: 'Some Page', metadata: {} })];
      const result = formatDocumentation(docs);
      expect(result).toContain('relevance: unknown');
      expect(result).toContain('— unknown');
    });
  });

  // ─── formatPullRequests() ───────────────

  describe('formatPullRequests()', () => {
    it('returns empty string for empty array', () => {
      expect(formatPullRequests([])).toBe('');
    });

    it('formats PR with files and repo', () => {
      const prs = [makePr('42', 'feat: add OAuth2', 'open', '12', 'owner/repo')];
      const result = formatPullRequests(prs);
      expect(result).toContain('PR #42');
      expect(result).toContain('"feat: add OAuth2"');
      expect(result).toContain('open');
      expect(result).toContain('12 files');
      expect(result).toContain('owner/repo');
    });
  });

  // ─── formatTopics() ────────────────────

  describe('formatTopics()', () => {
    it('returns empty string for empty array', () => {
      expect(formatTopics([])).toBe('');
    });

    it('formats topic with strength and entity count', () => {
      const topics = [makeTopic('authentication', 0.85, 4)];
      const result = formatTopics(topics);
      expect(result).toContain('authentication');
      expect(result).toContain('strength: 0.85');
      expect(result).toContain('4 entities');
    });
  });

  // ─── formatCrossReferences() ───────────

  describe('formatCrossReferences()', () => {
    it('returns empty string for empty array', () => {
      expect(formatCrossReferences([])).toBe('');
    });

    it('formats cross-reference with source→target', () => {
      const refs = [makeXref('PROJ-100', '12345', 'jira', 'confluence', 'link', 0.87)];
      const result = formatCrossReferences(refs);
      expect(result).toContain('jira:PROJ-100');
      expect(result).toContain('→');
      expect(result).toContain('confluence:12345');
      expect(result).toContain('link');
      expect(result).toContain('confidence: 0.87');
    });
  });

  // ─── formatRelationshipContext() ────────

  describe('formatRelationshipContext()', () => {
    it('returns empty string for empty context', () => {
      expect(formatRelationshipContext(makeContext())).toBe('');
    });

    it('produces all sections for full context', () => {
      const ctx = makeContext({
        siblings: [makeSibling('PROJ-101', 'Sibling task', 'Done')],
        documentation: [makeDoc('Auth Spec', '0.9', 'SPEC')],
        pullRequests: [makePr('42', 'feat: auth', 'open', '5', 'repo')],
        topics: [makeTopic('auth', 0.8, 3)],
        crossReferences: [makeXref('PROJ-100', '12345', 'jira', 'confluence', 'link', 0.75)],
      });
      const result = formatRelationshipContext(ctx);
      expect(result).toContain('## Relationship Context');
      expect(result).toContain('### Epic & Siblings');
      expect(result).toContain('### Documentation');
      expect(result).toContain('### Pull Requests');
      expect(result).toContain('### Topic Clusters');
      expect(result).toContain('### Cross-References');
    });

    it('output is under token budget', () => {
      const ctx = makeContext({
        siblings: [makeSibling('PROJ-101', 'Task A', 'Done')],
        documentation: [makeDoc('Doc A', '0.9', 'SPEC')],
      });
      const result = formatRelationshipContext(ctx);
      expect(estimateTokens(result)).toBeLessThan(2000);
    });
  });

  // ─── buildActionContext() ───────────────

  describe('buildActionContext()', () => {
    it('evaluate-issue includes siblings and documentation', () => {
      const ctx = makeContext({
        siblings: [makeSibling('PROJ-101', 'Task A', 'Done')],
        documentation: [makeDoc('Spec', '0.9', 'SPEC')],
        pullRequests: [makePr('42', 'PR', 'open', '5', 'repo')],
      });
      const result = buildActionContext('evaluate-issue', ctx);
      expect(result).toContain('Epic & Siblings');
      expect(result).toContain('Documentation');
      expect(result).not.toContain('### Pull Requests');
    });

    it('check-pr-consistency includes PRs and topics', () => {
      const ctx = makeContext({
        siblings: [makeSibling('PROJ-101', 'Task A', 'Done')],
        pullRequests: [makePr('42', 'PR', 'open', '5', 'repo')],
        topics: [makeTopic('auth', 0.8, 3)],
      });
      const result = buildActionContext('check-pr-consistency', ctx);
      expect(result).toContain('Pull Requests');
      expect(result).toContain('Topic Clusters');
      expect(result).not.toContain('Epic & Siblings');
    });

    it('validate-spec-alignment includes docs and cross-refs', () => {
      const ctx = makeContext({
        documentation: [makeDoc('Spec', '0.9', 'SPEC')],
        crossReferences: [makeXref('PROJ-100', '12345', 'jira', 'confluence', 'link', 0.75)],
        siblings: [makeSibling('PROJ-101', 'Task A', 'Done')],
      });
      const result = buildActionContext('validate-spec-alignment', ctx);
      expect(result).toContain('Documentation');
      expect(result).toContain('Cross-References');
      expect(result).not.toContain('Epic & Siblings');
    });

    it('unknown action falls back to full context', () => {
      const ctx = makeContext({
        siblings: [makeSibling('PROJ-101', 'Task A', 'Done')],
      });
      const result = buildActionContext('unknown-action', ctx);
      expect(result).toContain('## Relationship Context');
    });

    it('respects token budget', () => {
      const manySiblings = Array.from({ length: 100 }, (_, i) =>
        makeSibling(`PROJ-${i}`, `Task ${i} with a longer name to consume tokens`, 'In Progress'),
      );
      const ctx = makeContext({ siblings: manySiblings });
      const result = buildActionContext('evaluate-issue', ctx, {
        maxTokens: 200,
        reserveForPrompt: 50,
      });
      expect(estimateTokens(result)).toBeLessThanOrEqual(200);
    });

    it('returns empty string for empty context', () => {
      const result = buildActionContext('evaluate-issue', makeContext());
      expect(result).toBe('');
    });
  });

  // ─── buildPathContext() ─────────────────

  describe('buildPathContext()', () => {
    it('positions facts at start, paths in middle, decisions at end', () => {
      const paths = [makePath('contradiction', 0.9, 'Sibling contradicts this ticket')];
      const facts = ['Ticket belongs to epic PROJ-100', 'Epic has 3 siblings'];
      const decisions = [makeDecision({ issueKey: 'PROJ-99', action: 'block', overridden: true })];
      const result = buildPathContext(paths, facts, decisions, BUDGET);
      const factsIdx = result.indexOf('Key Facts');
      const pathsIdx = result.indexOf('Evidence Paths');
      const decIdx = result.indexOf('Recent Decisions');
      expect(factsIdx).toBeGreaterThan(-1);
      expect(pathsIdx).toBeGreaterThan(factsIdx);
      expect(decIdx).toBeGreaterThan(pathsIdx);
    });

    it('respects budget', () => {
      const manyPaths = Array.from({ length: 200 }, (_, i) =>
        makePath('neutral', 0.3, `Path ${i}: long description to consume tokens quickly`),
      );
      const result = buildPathContext(manyPaths, [], [], BUDGET);
      expect(estimateTokens(result)).toBeLessThanOrEqual(BUDGET.maxTokens);
    });

    it('returns facts and decisions when paths are empty', () => {
      const facts = ['Fact one'];
      const decisions = [makeDecision()];
      const result = buildPathContext([], facts, decisions, BUDGET);
      expect(result).toContain('Key Facts');
      expect(result).toContain('Recent Decisions');
      expect(result).not.toContain('Evidence Paths');
    });

    it('returns empty string when all inputs are empty', () => {
      expect(buildPathContext([], [], [], BUDGET)).toBe('');
    });

    it('sorts paths by signal score descending', () => {
      const paths = [
        makePath('neutral', 0.3, 'Low signal'),
        makePath('contradiction', 0.9, 'High signal'),
        makePath('alignment', 0.6, 'Mid signal'),
      ];
      const result = buildPathContext(paths, [], [], BUDGET);
      const highIdx = result.indexOf('High signal');
      const midIdx = result.indexOf('Mid signal');
      const lowIdx = result.indexOf('Low signal');
      expect(highIdx).toBeLessThan(midIdx);
      expect(midIdx).toBeLessThan(lowIdx);
    });

    it('limits decisions to 5', () => {
      const decisions = Array.from({ length: 10 }, (_, i) =>
        makeDecision({ issueKey: `PROJ-${i}` }),
      );
      const result = buildPathContext([], [], decisions, {
        maxTokens: 5000,
        reserveForPrompt: 500,
      });
      const lines = result.split('\n').filter((l) => l.startsWith('- PROJ-'));
      expect(lines).toHaveLength(5);
    });
  });

  // ─── buildEvolvingPrompt() ──────────────

  describe('buildEvolvingPrompt()', () => {
    it('suggests softening for high override rate', () => {
      const patterns = [{ contextSignature: 'PROJ:block:low', overrideRate: 0.65 }];
      const result = buildEvolvingPrompt(patterns);
      expect(result).toContain('Adaptive Guidance');
      expect(result).toContain('high override rate');
      expect(result).toContain('65%');
      expect(result).toContain('softening');
    });

    it('reports confidence for low override rate', () => {
      const patterns = [{ contextSignature: 'PROJ:approve:high', overrideRate: 0.05 }];
      const result = buildEvolvingPrompt(patterns);
      expect(result).toContain('low override rate');
      expect(result).toContain('5%');
      expect(result).toContain('well-calibrated');
    });

    it('returns empty string for empty patterns', () => {
      expect(buildEvolvingPrompt([])).toBe('');
    });

    it('returns empty string when no patterns meet thresholds', () => {
      const patterns = [{ contextSignature: 'PROJ:block:mid', overrideRate: 0.3 }];
      expect(buildEvolvingPrompt(patterns)).toBe('');
    });

    it('caps at ~200 tokens', () => {
      const patterns = Array.from({ length: 100 }, (_, i) => ({
        contextSignature: `ctx-${i}`,
        overrideRate: 0.6 + i * 0.003,
      }));
      const result = buildEvolvingPrompt(patterns);
      expect(estimateTokens(result)).toBeLessThanOrEqual(210);
    });
  });

  // ─── Rulebook compliance ────────────────

  describe('rulebook compliance', () => {
    it('[ARCH-SOLID-0912] produces deterministic output', () => {
      const ctx = makeContext({
        siblings: [makeSibling('PROJ-101', 'Task A', 'Done')],
        documentation: [makeDoc('Doc A', '0.9', 'SPEC')],
      });
      const result1 = formatRelationshipContext(ctx);
      const result2 = formatRelationshipContext(ctx);
      expect(result1).toBe(result2);
    });

    it('[FORGE-OPS-0104] graceful degradation on empty context', () => {
      const ctx = makeContext();
      expect(formatRelationshipContext(ctx)).toBe('');
      expect(buildActionContext('evaluate-issue', ctx)).toBe('');
    });
  });
});
