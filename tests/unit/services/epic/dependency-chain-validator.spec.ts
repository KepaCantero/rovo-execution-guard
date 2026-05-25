import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../../../src/backend/services/jira/jira-adapter');

import {
  validateDependencyChain,
  buildDependencyGraph,
  detectCircularDependencies,
  checkUpstreamResolution,
  batchFetchLinkedTickets,
} from '../../../../src/backend/services/epic/dependency-chain-validator';
import { getTicketData } from '../../../../src/backend/services/jira/jira-adapter';
import type { JiraTicketData, JiraIssueLink } from '../../../../src/backend/types/jira-data';
import type { DependencyNode, DependencyEdge } from '../../../../src/backend/types/epic-types';

const mockGetTicketData = jest.mocked(getTicketData);

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const makeTicket = (overrides: Partial<JiraTicketData> = {}): JiraTicketData => ({
  key: 'PROJ-1',
  summary: 'Test',
  description: 'Desc',
  status: 'IN PROGRESS',
  issueType: 'Task',
  labels: [],
  projectKey: 'PROJ',
  created: '2026-01-01T00:00:00.000Z',
  updated: new Date().toISOString(),
  ...overrides,
});

const makeLink = (overrides: Partial<JiraIssueLink> = {}): JiraIssueLink => ({
  type: 'Blocks',
  direction: 'inward',
  targetKey: 'PROJ-2',
  targetSummary: 'Linked ticket',
  targetStatus: 'IN PROGRESS',
  ...overrides,
});

const makeNode = (overrides: Partial<DependencyNode> = {}): DependencyNode => ({
  ticketKey: 'PROJ-1',
  summary: 'Test',
  status: 'IN PROGRESS',
  resolved: false,
  ...overrides,
});

const makeEdge = (overrides: Partial<DependencyEdge> = {}): DependencyEdge => ({
  source: 'PROJ-2',
  target: 'PROJ-1',
  linkType: 'is blocked by',
  direction: 'upstream',
  ...overrides,
});

// ═══════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════

describe('detectCircularDependencies', () => {
  it('finds simple A->B->A cycle', () => {
    const nodes: readonly DependencyNode[] = [
      makeNode({ ticketKey: 'A' }),
      makeNode({ ticketKey: 'B' }),
    ];
    const edges: readonly DependencyEdge[] = [
      makeEdge({ source: 'A', target: 'B', linkType: 'blocks', direction: 'downstream' }),
      makeEdge({ source: 'B', target: 'A', linkType: 'is blocked by', direction: 'upstream' }),
    ];

    const cycles = detectCircularDependencies(nodes, edges);
    expect(cycles.length).toBeGreaterThanOrEqual(1);
    const first = cycles[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.severity).toBe('critical');
      expect(first.description).toContain('Circular dependency');
    }
  });

  it('finds longer A->B->C->A cycle', () => {
    const nodes: readonly DependencyNode[] = [
      makeNode({ ticketKey: 'A' }),
      makeNode({ ticketKey: 'B' }),
      makeNode({ ticketKey: 'C' }),
    ];
    const edges: readonly DependencyEdge[] = [
      makeEdge({ source: 'A', target: 'B', linkType: 'blocks', direction: 'downstream' }),
      makeEdge({ source: 'B', target: 'C', linkType: 'blocks', direction: 'downstream' }),
      makeEdge({ source: 'C', target: 'A', linkType: 'is blocked by', direction: 'upstream' }),
    ];

    const cycles = detectCircularDependencies(nodes, edges);
    expect(cycles.length).toBeGreaterThanOrEqual(1);
    const first = cycles[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.severity).toBe('warning');
    }
  });

  it('returns empty for acyclic graph', () => {
    const nodes: readonly DependencyNode[] = [
      makeNode({ ticketKey: 'A' }),
      makeNode({ ticketKey: 'B' }),
    ];
    const edges: readonly DependencyEdge[] = [
      makeEdge({ source: 'A', target: 'B', linkType: 'blocks', direction: 'downstream' }),
    ];

    const cycles = detectCircularDependencies(nodes, edges);
    expect(cycles).toHaveLength(0);
  });

  it('returns empty for empty graph', () => {
    const cycles = detectCircularDependencies([], []);
    expect(cycles).toHaveLength(0);
  });
});

describe('checkUpstreamResolution', () => {
  it('returns unresolved upstream nodes', () => {
    const nodes: readonly DependencyNode[] = [
      makeNode({ ticketKey: 'PROJ-1', resolved: false }),
      makeNode({ ticketKey: 'PROJ-2', resolved: false }),
      makeNode({ ticketKey: 'PROJ-3', resolved: true }),
    ];
    const edges: readonly DependencyEdge[] = [
      makeEdge({ source: 'PROJ-2', target: 'PROJ-1', direction: 'upstream' }),
      makeEdge({ source: 'PROJ-3', target: 'PROJ-1', direction: 'upstream' }),
    ];

    const unresolved = checkUpstreamResolution(edges, nodes);
    expect(unresolved).toHaveLength(1);
    const first = unresolved[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.ticketKey).toBe('PROJ-2');
    }
  });

  it('returns empty when all upstream resolved', () => {
    const nodes: readonly DependencyNode[] = [
      makeNode({ ticketKey: 'PROJ-1', resolved: false }),
      makeNode({ ticketKey: 'PROJ-2', resolved: true }),
    ];
    const edges: readonly DependencyEdge[] = [
      makeEdge({ source: 'PROJ-2', target: 'PROJ-1', direction: 'upstream' }),
    ];

    const unresolved = checkUpstreamResolution(edges, nodes);
    expect(unresolved).toHaveLength(0);
  });

  it('returns empty when no upstream edges', () => {
    const nodes: readonly DependencyNode[] = [makeNode({ ticketKey: 'PROJ-1', resolved: false })];
    const edges: readonly DependencyEdge[] = [
      makeEdge({ source: 'PROJ-1', target: 'PROJ-2', direction: 'downstream' }),
    ];

    const unresolved = checkUpstreamResolution(edges, nodes);
    expect(unresolved).toHaveLength(0);
  });
});

describe('validateDependencyChain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows transition when no dependencies', async () => {
    mockGetTicketData.mockResolvedValue(makeTicket({ issueLinks: [] }));

    const result = await validateDependencyChain('PROJ-1', 'PROJ', 'exec-1');
    expect(result.canTransition).toBe(true);
    expect(result.unresolvedUpstream).toHaveLength(0);
    expect(result.circularDependencies).toHaveLength(0);
    expect(result.blockingReason).toBeUndefined();
  });

  it('blocks when upstream dependency unresolved', async () => {
    const blockedTicket = makeTicket({
      key: 'PROJ-1',
      issueLinks: [makeLink({ type: 'Blocks', direction: 'inward', targetKey: 'PROJ-2' })],
    });
    const upstreamTicket = makeTicket({
      key: 'PROJ-2',
      status: 'IN PROGRESS',
      issueLinks: [],
    });

    mockGetTicketData.mockResolvedValueOnce(blockedTicket).mockResolvedValueOnce(upstreamTicket);

    const result = await validateDependencyChain('PROJ-1', 'PROJ', 'exec-2');
    expect(result.canTransition).toBe(false);
    expect(result.unresolvedUpstream.length).toBeGreaterThanOrEqual(1);
    expect(result.blockingReason).toContain('Unresolved upstream');
  });

  it('detects circular dependency', async () => {
    // Mutual blocking: A is blocked by B, B is blocked by A
    // Both have inward "Blocks" links = upstream edges A->B and B->A = cycle
    const ticketA = makeTicket({
      key: 'PROJ-A',
      issueLinks: [makeLink({ type: 'Blocks', direction: 'inward', targetKey: 'PROJ-B' })],
    });
    const ticketB = makeTicket({
      key: 'PROJ-B',
      issueLinks: [makeLink({ type: 'Blocks', direction: 'inward', targetKey: 'PROJ-A' })],
    });

    // Mock sequence:
    // 1. validateDependencyChain -> getTicketData('PROJ-A') -> ticketA
    // 2. buildDependencyGraph(ticketA) -> batchFetch -> getTicketData('PROJ-B') -> ticketB
    // 3. buildDependencyGraph(ticketA) -> recurse -> getTicketData('PROJ-B') -> ticketB
    // 4. buildDependencyGraph(ticketB, depth=1) -> batchFetch -> getTicketData('PROJ-A') -> ticketA
    // 5. buildDependencyGraph(ticketB, depth=1) -> recurse -> getTicketData('PROJ-A') -> ticketA
    mockGetTicketData
      .mockResolvedValueOnce(ticketA) // validateDependencyChain fetches PROJ-A
      .mockResolvedValueOnce(ticketB) // batchFetch for PROJ-B (from A's graph)
      .mockResolvedValueOnce(ticketB) // recurse into PROJ-B
      .mockResolvedValueOnce(ticketA) // batchFetch for PROJ-A (from B's graph at depth 1)
      .mockResolvedValueOnce(ticketA); // recurse into PROJ-A (depth 2)

    const result = await validateDependencyChain('PROJ-A', 'PROJ', 'exec-3');
    expect(result.canTransition).toBe(false);
    expect(result.circularDependencies.length).toBeGreaterThanOrEqual(1);
    expect(result.blockingReason).toContain('Circular dependencies');
  });

  it('handles deep dependency chain', async () => {
    const root = makeTicket({
      key: 'PROJ-1',
      issueLinks: [makeLink({ type: 'Blocks', direction: 'inward', targetKey: 'PROJ-2' })],
    });
    const level1 = makeTicket({
      key: 'PROJ-2',
      status: 'IN PROGRESS',
      issueLinks: [makeLink({ type: 'Blocks', direction: 'inward', targetKey: 'PROJ-3' })],
    });
    const level2 = makeTicket({
      key: 'PROJ-3',
      status: 'IN PROGRESS',
      issueLinks: [makeLink({ type: 'Blocks', direction: 'inward', targetKey: 'PROJ-4' })],
    });
    const level3 = makeTicket({
      key: 'PROJ-4',
      status: 'IN PROGRESS',
      issueLinks: [makeLink({ type: 'Blocks', direction: 'inward', targetKey: 'PROJ-5' })],
    });
    const level4 = makeTicket({
      key: 'PROJ-5',
      status: 'DONE',
      issueLinks: [],
    });

    mockGetTicketData
      .mockResolvedValueOnce(root)
      .mockResolvedValueOnce(level1)
      .mockResolvedValueOnce(level2)
      .mockResolvedValueOnce(level3)
      .mockResolvedValueOnce(level4);

    const result = await validateDependencyChain('PROJ-1', 'PROJ', 'exec-4');
    // Depth is capped at 3, so PROJ-5 should not be traversed
    expect(result.canTransition).toBe(false);
    expect(result.upstreamDeps.length).toBeGreaterThanOrEqual(1);
  });

  it('degrades gracefully on fetch error', async () => {
    mockGetTicketData.mockRejectedValue(new Error('Jira API down'));

    const result = await validateDependencyChain('PROJ-1', 'PROJ', 'exec-5');
    // Fail-open: canTransition is true on error
    expect(result.canTransition).toBe(true);
    expect(result.unresolvedUpstream).toHaveLength(0);
    expect(result.circularDependencies).toHaveLength(0);
  });
});

describe('buildDependencyGraph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds graph from issue links', async () => {
    const mainTicket = makeTicket({
      key: 'PROJ-1',
      issueLinks: [
        makeLink({ type: 'Blocks', direction: 'inward', targetKey: 'PROJ-2' }),
        makeLink({ type: 'Blocks', direction: 'outward', targetKey: 'PROJ-3' }),
      ],
    });
    const upstreamTicket = makeTicket({
      key: 'PROJ-2',
      status: 'IN PROGRESS',
      issueLinks: [],
    });
    const downstreamTicket = makeTicket({
      key: 'PROJ-3',
      status: 'DONE',
      issueLinks: [],
    });

    mockGetTicketData
      .mockResolvedValueOnce(upstreamTicket)
      .mockResolvedValueOnce(downstreamTicket)
      .mockResolvedValueOnce(upstreamTicket)
      .mockResolvedValueOnce(downstreamTicket);

    const { nodes, edges } = await buildDependencyGraph(mainTicket, 'exec-10');
    expect(nodes.length).toBeGreaterThanOrEqual(3);
    expect(edges.length).toBeGreaterThanOrEqual(2);

    const upstreamEdges = edges.filter((e) => e.direction === 'upstream');
    const downstreamEdges = edges.filter((e) => e.direction === 'downstream');
    expect(upstreamEdges.length).toBeGreaterThanOrEqual(1);
    expect(downstreamEdges.length).toBeGreaterThanOrEqual(1);
  });

  it('respects max depth', async () => {
    const ticket = makeTicket({
      key: 'PROJ-1',
      issueLinks: [makeLink({ targetKey: 'PROJ-2' })],
    });

    // buildDependencyGraph is called recursively with depth tracking.
    // When depth >= MAX_TRAVERSAL_DEPTH (3), no further recursion happens.
    // We call directly with depth = 3 to verify it stops.
    const { nodes, edges } = await buildDependencyGraph(ticket, 'exec-11', 3);
    // At max depth, only the root node is returned with no new fetches
    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
  });

  it('handles missing ticket data gracefully', async () => {
    const ticket = makeTicket({
      key: 'PROJ-1',
      issueLinks: [makeLink({ targetKey: 'PROJ-MISSING' }), makeLink({ targetKey: 'PROJ-VALID' })],
    });

    mockGetTicketData
      .mockRejectedValueOnce(new Error('Not found'))
      .mockResolvedValueOnce(makeTicket({ key: 'PROJ-VALID', issueLinks: [] }))
      .mockResolvedValueOnce(makeTicket({ key: 'PROJ-VALID', issueLinks: [] }));

    const { nodes } = await buildDependencyGraph(ticket, 'exec-12');
    // PROJ-1 + PROJ-VALID (PROJ-MISSING failed but gracefully skipped)
    expect(nodes.length).toBeGreaterThanOrEqual(2);
    const keys = nodes.map((n) => n.ticketKey);
    expect(keys).toContain('PROJ-1');
    expect(keys).toContain('PROJ-VALID');
  });

  it('returns single node for ticket with no links', async () => {
    const ticket = makeTicket({ key: 'PROJ-1', issueLinks: [] });
    const { nodes, edges } = await buildDependencyGraph(ticket, 'exec-13');
    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
  });
});

describe('batchFetchLinkedTickets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches linked tickets in batches', async () => {
    mockGetTicketData
      .mockResolvedValueOnce(makeTicket({ key: 'PROJ-2' }))
      .mockResolvedValueOnce(makeTicket({ key: 'PROJ-3' }));

    const links: readonly JiraIssueLink[] = [
      makeLink({ targetKey: 'PROJ-2' }),
      makeLink({ targetKey: 'PROJ-3' }),
    ];

    const nodes = await batchFetchLinkedTickets(links, 'exec-20');
    expect(nodes).toHaveLength(2);
    const first = nodes[0];
    const second = nodes[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first) expect(first.ticketKey).toBe('PROJ-2');
    if (second) expect(second.ticketKey).toBe('PROJ-3');
  });

  it('skips failed fetches gracefully', async () => {
    mockGetTicketData
      .mockResolvedValueOnce(makeTicket({ key: 'PROJ-2' }))
      .mockRejectedValueOnce(new Error('Not found'));

    const links: readonly JiraIssueLink[] = [
      makeLink({ targetKey: 'PROJ-2' }),
      makeLink({ targetKey: 'PROJ-MISSING' }),
    ];

    const nodes = await batchFetchLinkedTickets(links, 'exec-21');
    expect(nodes).toHaveLength(1);
    const first = nodes[0];
    expect(first).toBeDefined();
    if (first) expect(first.ticketKey).toBe('PROJ-2');
  });
});
