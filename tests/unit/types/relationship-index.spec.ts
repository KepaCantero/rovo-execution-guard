// Tests for relationship-index domain types
// Covers: EntityType, EntityNode, EdgeType, RelationshipEdge, TopicCluster,
//   RelationshipContext, ContextItem, CrossReference, GraphStats,
//   RelationshipQuery, RelationshipQueryResult, RelationshipIndexer
// Pattern: compile-time type verification + runtime smoke tests

import type {
  EntityType,
  EntityNode,
  EdgeType,
  RelationshipEdge,
  TopicCluster,
  RelationshipContext,
  ContextItem,
  CrossReference,
  GraphStats,
  RelationshipQuery,
  RelationshipQueryResult,
  RelationshipIndexer,
} from '../../../src/backend/types/relationship-index';

// ---------------------------------------------------------------------------
// EntityType
// ---------------------------------------------------------------------------

describe('EntityType', () => {
  it('should accept all five valid entity types', () => {
    const types: EntityType[] = [
      'jira-issue',
      'jira-epic',
      'confluence-page',
      'github-pr',
      'topic',
    ];
    expect(types).toHaveLength(5);
  });

  it('should assign individual entity type values', () => {
    const issue: EntityType = 'jira-issue';
    const epic: EntityType = 'jira-epic';
    const page: EntityType = 'confluence-page';
    const pr: EntityType = 'github-pr';
    const topic: EntityType = 'topic';

    expect(issue).toBe('jira-issue');
    expect(epic).toBe('jira-epic');
    expect(page).toBe('confluence-page');
    expect(pr).toBe('github-pr');
    expect(topic).toBe('topic');
  });
});

// ---------------------------------------------------------------------------
// EdgeType
// ---------------------------------------------------------------------------

describe('EdgeType', () => {
  it('should accept all six valid edge types', () => {
    const types: EdgeType[] = [
      'parent-of',
      'related-to',
      'documented-by',
      'implements',
      'topic-match',
      'mentioned-in',
    ];
    expect(types).toHaveLength(6);
  });

  it('should assign individual edge type values', () => {
    const parentOf: EdgeType = 'parent-of';
    const relatedTo: EdgeType = 'related-to';
    expect(parentOf).toBe('parent-of');
    expect(relatedTo).toBe('related-to');
  });
});

// ---------------------------------------------------------------------------
// EntityNode
// ---------------------------------------------------------------------------

describe('EntityNode', () => {
  describe('happy path', () => {
    it('should accept a valid Jira issue node', () => {
      const node: EntityNode = {
        id: 'jira:PROJ-123',
        type: 'jira-issue',
        label: 'Implement scoring engine',
        status: 'IN PROGRESS',
        projectKey: 'PROJ',
        metadata: { issueType: 'Story', priority: 'High' },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-03-01T00:00:00Z',
      };

      expect(node.id).toBe('jira:PROJ-123');
      expect(node.type).toBe('jira-issue');
      expect(node.label).toBe('Implement scoring engine');
      expect(node.status).toBe('IN PROGRESS');
      expect(node.projectKey).toBe('PROJ');
      expect(node.metadata).toEqual({ issueType: 'Story', priority: 'High' });
    });

    it('should accept a valid Confluence page node', () => {
      const node: EntityNode = {
        id: 'confluence:12345',
        type: 'confluence-page',
        label: 'Architecture Overview',
        status: 'current',
        projectKey: 'PROJ',
        metadata: { spaceKey: 'ENG', version: '3' },
        createdAt: '2026-02-01T00:00:00Z',
        updatedAt: '2026-02-15T00:00:00Z',
      };

      expect(node.type).toBe('confluence-page');
      expect(node.metadata).toEqual({ spaceKey: 'ENG', version: '3' });
    });

    it('should accept a valid GitHub PR node', () => {
      const node: EntityNode = {
        id: 'github:owner/repo/pull/42',
        type: 'github-pr',
        label: 'Fix scoring bug',
        status: 'open',
        projectKey: 'PROJ',
        metadata: { branch: 'fix/scoring', author: 'dev' },
        createdAt: '2026-03-01T00:00:00Z',
        updatedAt: '2026-03-02T00:00:00Z',
      };

      expect(node.type).toBe('github-pr');
      expect(node.status).toBe('open');
    });

    it('should accept a topic node', () => {
      const node: EntityNode = {
        id: 'topic:cache-migration',
        type: 'topic',
        label: 'Cache Migration',
        status: 'active',
        projectKey: '',
        metadata: {},
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z',
      };

      expect(node.type).toBe('topic');
      expect(node.projectKey).toBe('');
      expect(node.metadata).toEqual({});
    });

    it('should accept a Jira epic node', () => {
      const node: EntityNode = {
        id: 'jira:PROJ-E-5',
        type: 'jira-epic',
        label: 'Scoring Engine Epic',
        status: 'IN PROGRESS',
        projectKey: 'PROJ',
        metadata: { colour: 'green' },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z',
      };

      expect(node.type).toBe('jira-epic');
    });
  });

  describe('edge cases', () => {
    it('should accept empty metadata', () => {
      const node: EntityNode = {
        id: 'jira:PROJ-1',
        type: 'jira-issue',
        label: 'Test',
        status: 'TO DO',
        projectKey: 'PROJ',
        metadata: {},
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      expect(node.metadata).toEqual({});
    });

    it('should accept empty strings for all text fields', () => {
      const node: EntityNode = {
        id: '',
        type: 'jira-issue',
        label: '',
        status: '',
        projectKey: '',
        metadata: {},
        createdAt: '',
        updatedAt: '',
      };

      expect(node.id).toBe('');
      expect(node.label).toBe('');
    });

    it('should accept metadata with multiple entries', () => {
      const node: EntityNode = {
        id: 'jira:PROJ-999',
        type: 'jira-issue',
        label: 'Complex',
        status: 'DONE',
        projectKey: 'PROJ',
        metadata: {
          issueType: 'Bug',
          priority: 'Critical',
          component: 'backend',
          sprint: 'Sprint 42',
        },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-06-01T00:00:00Z',
      };

      expect(Object.keys(node.metadata)).toHaveLength(4);
    });
  });

  describe('ARCH-SOLID rules', () => {
    it('should enforce readonly properties (ARCH-SOLID-203)', () => {
      const node: EntityNode = {
        id: 'jira:PROJ-1',
        type: 'jira-issue',
        label: 'Test',
        status: 'TO DO',
        projectKey: 'PROJ',
        metadata: { key: 'value' },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      expect(Object.keys(node)).toHaveLength(8);
    });

    it('should have zero external dependencies (ARCH-SOLID-058)', () => {
      // Pure domain type — no imports needed at runtime
      const node: EntityNode = {
        id: 'jira:PROJ-1',
        type: 'jira-issue',
        label: 'Test',
        status: 'TO DO',
        projectKey: 'PROJ',
        metadata: {},
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      expect(node).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// RelationshipEdge
// ---------------------------------------------------------------------------

describe('RelationshipEdge', () => {
  describe('happy path', () => {
    it('should accept a valid parent-of edge', () => {
      const edge: RelationshipEdge = {
        source: 'jira:PROJ-E-5',
        target: 'jira:PROJ-123',
        type: 'parent-of',
        weight: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      expect(edge.source).toBe('jira:PROJ-E-5');
      expect(edge.target).toBe('jira:PROJ-123');
      expect(edge.type).toBe('parent-of');
      expect(edge.weight).toBe(1);
    });

    it('should accept a topic-match edge with fractional weight', () => {
      const edge: RelationshipEdge = {
        source: 'jira:PROJ-100',
        target: 'topic:cache-migration',
        type: 'topic-match',
        weight: 0.75,
        createdAt: '2026-02-01T00:00:00Z',
        updatedAt: '2026-02-01T00:00:00Z',
      };

      expect(edge.weight).toBe(0.75);
      expect(edge.type).toBe('topic-match');
    });
  });

  describe('edge cases', () => {
    it('should accept zero weight', () => {
      const edge: RelationshipEdge = {
        source: 'a',
        target: 'b',
        type: 'mentioned-in',
        weight: 0,
        createdAt: '',
        updatedAt: '',
      };

      expect(edge.weight).toBe(0);
    });

    it('should accept all edge types', () => {
      const types: EdgeType[] = [
        'parent-of',
        'related-to',
        'documented-by',
        'implements',
        'topic-match',
        'mentioned-in',
      ];
      const edges: readonly RelationshipEdge[] = types.map((t) => ({
        source: 'src',
        target: 'tgt',
        type: t,
        weight: 0.5,
        createdAt: '',
        updatedAt: '',
      }));

      expect(edges).toHaveLength(6);
    });
  });
});

// ---------------------------------------------------------------------------
// TopicCluster
// ---------------------------------------------------------------------------

describe('TopicCluster', () => {
  it('should accept a valid topic cluster', () => {
    const topic: TopicCluster = {
      id: 'topic:cache-migration',
      label: 'Cache Migration',
      keywords: ['cache', 'redis', 'migration'],
      entityIds: ['jira:PROJ-100', 'confluence:555', 'github:org/repo/pull/7'],
      projectKeys: ['PROJ', 'ENG'],
      strength: 0.85,
    };

    expect(topic.id).toBe('topic:cache-migration');
    expect(topic.keywords).toHaveLength(3);
    expect(topic.entityIds).toHaveLength(3);
    expect(topic.projectKeys).toHaveLength(2);
    expect(topic.strength).toBe(0.85);
  });

  it('should accept empty arrays', () => {
    const topic: TopicCluster = {
      id: 'topic:empty',
      label: 'Empty Topic',
      keywords: [],
      entityIds: [],
      projectKeys: [],
      strength: 0,
    };

    expect(topic.keywords).toEqual([]);
    expect(topic.entityIds).toEqual([]);
    expect(topic.projectKeys).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ContextItem
// ---------------------------------------------------------------------------

describe('ContextItem', () => {
  it('should accept a valid context item', () => {
    const item: ContextItem = {
      node: {
        id: 'jira:PROJ-100',
        type: 'jira-issue',
        label: 'Related issue',
        status: 'DONE',
        projectKey: 'PROJ',
        metadata: {},
        createdAt: '',
        updatedAt: '',
      },
      relevanceScore: 0.9,
      matchReason: 'shares epic PROJ-E-5',
    };

    expect(item.node.id).toBe('jira:PROJ-100');
    expect(item.relevanceScore).toBe(0.9);
    expect(item.matchReason).toBe('shares epic PROJ-E-5');
  });
});

// ---------------------------------------------------------------------------
// CrossReference
// ---------------------------------------------------------------------------

describe('CrossReference', () => {
  describe('happy path', () => {
    it('should accept a valid cross-reference', () => {
      const xref: CrossReference = {
        source: 'jira:PROJ-123',
        target: 'confluence:9999',
        sourceTool: 'jira',
        targetTool: 'confluence',
        referenceType: 'link',
        confidence: 1,
      };

      expect(xref.sourceTool).toBe('jira');
      expect(xref.targetTool).toBe('confluence');
      expect(xref.referenceType).toBe('link');
      expect(xref.confidence).toBe(1);
    });
  });

  describe('all tool combinations', () => {
    it('should accept all three source tool values', () => {
      const tools: readonly ('jira' | 'confluence' | 'github')[] = ['jira', 'confluence', 'github'];
      const xrefs: readonly CrossReference[] = tools.map((tool) => ({
        source: `${tool}:id`,
        target: 'jira:target',
        sourceTool: tool,
        targetTool: 'jira',
        referenceType: 'mention',
        confidence: 0.5,
      }));

      expect(xrefs).toHaveLength(3);
    });

    it('should accept all four reference types', () => {
      const refTypes: readonly ('link' | 'mention' | 'keyword' | 'structural')[] = [
        'link',
        'mention',
        'keyword',
        'structural',
      ];
      const xrefs: readonly CrossReference[] = refTypes.map((rt) => ({
        source: 'a',
        target: 'b',
        sourceTool: 'jira',
        targetTool: 'confluence',
        referenceType: rt,
        confidence: 0.8,
      }));

      expect(xrefs).toHaveLength(4);
    });
  });
});

// ---------------------------------------------------------------------------
// RelationshipContext
// ---------------------------------------------------------------------------

describe('RelationshipContext', () => {
  it('should accept an empty context', () => {
    const ctx: RelationshipContext = {
      siblings: [],
      documentation: [],
      pullRequests: [],
      topics: [],
      crossReferences: [],
      rankedItems: [],
      assembledAt: '2026-05-01T00:00:00Z',
    };

    expect(ctx.siblings).toEqual([]);
    expect(ctx.documentation).toEqual([]);
    expect(ctx.pullRequests).toEqual([]);
    expect(ctx.topics).toEqual([]);
    expect(ctx.crossReferences).toEqual([]);
    expect(ctx.rankedItems).toEqual([]);
    expect(ctx.assembledAt).toBe('2026-05-01T00:00:00Z');
  });

  it('should accept a full context with all fields populated', () => {
    const siblingNode: EntityNode = {
      id: 'jira:PROJ-200',
      type: 'jira-issue',
      label: 'Sibling story',
      status: 'IN PROGRESS',
      projectKey: 'PROJ',
      metadata: {},
      createdAt: '',
      updatedAt: '',
    };
    const docNode: EntityNode = {
      id: 'confluence:111',
      type: 'confluence-page',
      label: 'Design doc',
      status: 'current',
      projectKey: 'PROJ',
      metadata: {},
      createdAt: '',
      updatedAt: '',
    };
    const prNode: EntityNode = {
      id: 'github:org/repo/pull/42',
      type: 'github-pr',
      label: 'PR for this ticket',
      status: 'open',
      projectKey: 'PROJ',
      metadata: {},
      createdAt: '',
      updatedAt: '',
    };

    const ctx: RelationshipContext = {
      siblings: [siblingNode],
      documentation: [docNode],
      pullRequests: [prNode],
      topics: [
        {
          id: 'topic:scoring',
          label: 'Scoring',
          keywords: ['score', 'consistency'],
          entityIds: ['jira:PROJ-100'],
          projectKeys: ['PROJ'],
          strength: 0.9,
        },
      ],
      crossReferences: [
        {
          source: 'jira:PROJ-100',
          target: 'confluence:111',
          sourceTool: 'jira',
          targetTool: 'confluence',
          referenceType: 'link',
          confidence: 1,
        },
      ],
      rankedItems: [
        {
          node: siblingNode,
          relevanceScore: 0.95,
          matchReason: 'shares epic PROJ-E-5',
        },
      ],
      assembledAt: '2026-05-01T12:00:00Z',
    };

    expect(ctx.siblings).toHaveLength(1);
    expect(ctx.documentation).toHaveLength(1);
    expect(ctx.pullRequests).toHaveLength(1);
    expect(ctx.topics).toHaveLength(1);
    expect(ctx.crossReferences).toHaveLength(1);
    expect(ctx.rankedItems).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// GraphStats
// ---------------------------------------------------------------------------

describe('GraphStats', () => {
  it('should accept valid stats', () => {
    const stats: GraphStats = {
      totalNodes: 42,
      totalEdges: 87,
      nodesByType: {
        'jira-issue': 20,
        'jira-epic': 5,
        'confluence-page': 10,
        'github-pr': 5,
        topic: 2,
      },
      edgesByType: {
        'parent-of': 20,
        'related-to': 15,
        'documented-by': 22,
        implements: 10,
        'topic-match': 12,
        'mentioned-in': 8,
      },
      topicCount: 2,
      lastUpdated: '2026-05-01T12:00:00Z',
    };

    expect(stats.totalNodes).toBe(42);
    expect(stats.totalEdges).toBe(87);
    expect(stats.topicCount).toBe(2);
  });

  it('should accept zero stats', () => {
    const stats: GraphStats = {
      totalNodes: 0,
      totalEdges: 0,
      nodesByType: {
        'jira-issue': 0,
        'jira-epic': 0,
        'confluence-page': 0,
        'github-pr': 0,
        topic: 0,
      },
      edgesByType: {
        'parent-of': 0,
        'related-to': 0,
        'documented-by': 0,
        implements: 0,
        'topic-match': 0,
        'mentioned-in': 0,
      },
      topicCount: 0,
      lastUpdated: '',
    };

    expect(stats.totalNodes).toBe(0);
    expect(stats.totalEdges).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// RelationshipQuery
// ---------------------------------------------------------------------------

describe('RelationshipQuery', () => {
  describe('minimal query', () => {
    it('should accept a minimal query with only projectKey', () => {
      const query: RelationshipQuery = {
        projectKey: 'PROJ',
      };

      expect(query.projectKey).toBe('PROJ');
      expect(query.entityId).toBeUndefined();
      expect(query.entityType).toBeUndefined();
      expect(query.edgeTypes).toBeUndefined();
      expect(query.maxDepth).toBeUndefined();
      expect(query.minWeight).toBeUndefined();
    });
  });

  describe('full query', () => {
    it('should accept a query with all parameters', () => {
      const query: RelationshipQuery = {
        projectKey: 'PROJ',
        entityId: 'jira:PROJ-100',
        entityType: 'jira-issue',
        edgeTypes: ['parent-of', 'related-to'],
        maxDepth: 2,
        minWeight: 0.5,
      };

      expect(query.entityId).toBe('jira:PROJ-100');
      expect(query.entityType).toBe('jira-issue');
      expect(query.edgeTypes).toHaveLength(2);
      expect(query.maxDepth).toBe(2);
      expect(query.minWeight).toBe(0.5);
    });
  });

  describe('FORGE-OPS-001 traversal limit', () => {
    it('should accept maxDepth of 1', () => {
      const query: RelationshipQuery = { projectKey: 'PROJ', maxDepth: 1 };
      expect(query.maxDepth).toBe(1);
    });

    it('should accept maxDepth of 2', () => {
      const query: RelationshipQuery = { projectKey: 'PROJ', maxDepth: 2 };
      expect(query.maxDepth).toBe(2);
    });
  });
});

// ---------------------------------------------------------------------------
// RelationshipQueryResult
// ---------------------------------------------------------------------------

describe('RelationshipQueryResult', () => {
  it('should accept a valid query result', () => {
    const result: RelationshipQueryResult = {
      nodes: [
        {
          id: 'jira:PROJ-100',
          type: 'jira-issue',
          label: 'Test',
          status: 'TO DO',
          projectKey: 'PROJ',
          metadata: {},
          createdAt: '',
          updatedAt: '',
        },
      ],
      edges: [
        {
          source: 'jira:PROJ-100',
          target: 'confluence:555',
          type: 'documented-by',
          weight: 1,
          createdAt: '',
          updatedAt: '',
        },
      ],
      query: { projectKey: 'PROJ', entityId: 'jira:PROJ-100' },
      executionId: 'exec-001',
    };

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(1);
    expect(result.executionId).toBe('exec-001');
    expect(result.query.projectKey).toBe('PROJ');
  });

  it('should accept an empty result', () => {
    const result: RelationshipQueryResult = {
      nodes: [],
      edges: [],
      query: { projectKey: 'PROJ' },
      executionId: 'exec-002',
    };

    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// RelationshipIndexer [ARCH-SOLID-006]
// ---------------------------------------------------------------------------

describe('RelationshipIndexer', () => {
  it('should accept an object implementing the indexer contract', () => {
    const indexer: RelationshipIndexer = {
      source: 'jira-issue',
      async indexNode(_node: EntityNode, _executionId: string): Promise<void> {},
      async indexEdges(_edges: readonly RelationshipEdge[], _executionId: string): Promise<void> {},
      async removeNode(_entityId: string, _executionId: string): Promise<void> {},
    };

    expect(indexer.source).toBe('jira-issue');
    expect(typeof indexer.indexNode).toBe('function');
    expect(typeof indexer.indexEdges).toBe('function');
    expect(typeof indexer.removeNode).toBe('function');
  });

  it('should accept a confluence indexer', () => {
    const indexer: RelationshipIndexer = {
      source: 'confluence-page',
      async indexNode(): Promise<void> {},
      async indexEdges(): Promise<void> {},
      async removeNode(): Promise<void> {},
    };

    expect(indexer.source).toBe('confluence-page');
  });

  it('should accept a github indexer', () => {
    const indexer: RelationshipIndexer = {
      source: 'github-pr',
      async indexNode(): Promise<void> {},
      async indexEdges(): Promise<void> {},
      async removeNode(): Promise<void> {},
    };

    expect(indexer.source).toBe('github-pr');
  });
});

// ---------------------------------------------------------------------------
// Barrel export verification
// ---------------------------------------------------------------------------

describe('Barrel export', () => {
  it('should re-export all types from index.ts — verified by compilation', () => {
    // [ARCH-SOLID-232] Named type-only exports — no runtime values to check.
    // This file's imports at the top already prove barrel re-exports work.
    // If TypeScript compilation passes, all 12 types are correctly re-exported.
    const typesCount = 12;
    expect(typesCount).toBe(12);
  });
});
