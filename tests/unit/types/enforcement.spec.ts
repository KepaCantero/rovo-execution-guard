// Test suite for EnforcementAction discriminated union domain type
// Covers: all four action variants, type narrowing, cross-module integration
// Tests: happy path, edge cases, discriminated union narrowing, array filtering

import type { EnforcementAction } from '../../../src/backend/types/enforcement';
import type { Inconsistency } from '../../../src/backend/types/inconsistency';

// Helper factory for creating a valid Inconsistency
function createTestInconsistency(overrides?: Partial<Inconsistency>): Inconsistency {
  return {
    id: 'inc-001',
    type: 'contradiction',
    severity: 'critical',
    source: 'jira',
    description: 'Contradiction found',
    affectedTicketKey: 'PROJ-100',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// BlockTransitionAction
// ---------------------------------------------------------------------------

describe('BlockTransitionAction', () => {
  it('should create a valid block_transition action', () => {
    // Arrange
    const transitionId = 'trans-1';
    const reason = 'Score below threshold';

    // Act
    const action: EnforcementAction = {
      type: 'block_transition',
      transitionId,
      reason,
    };

    // Assert
    expect(action.type).toBe('block_transition');

    if (action.type === 'block_transition') {
      expect(action.transitionId).toBe('trans-1');
      expect(action.reason).toBe('Score below threshold');
    }
  });

  it('should allow empty strings for transitionId and reason', () => {
    // Arrange & Act
    const action: EnforcementAction = {
      type: 'block_transition',
      transitionId: '',
      reason: '',
    };

    // Assert
    if (action.type === 'block_transition') {
      expect(action.transitionId).toBe('');
      expect(action.reason).toBe('');
    }
  });
});

// ---------------------------------------------------------------------------
// BlockPRAction
// ---------------------------------------------------------------------------

describe('BlockPRAction', () => {
  it('should create a valid block_pr action', () => {
    // Arrange
    const prNumber = 42;
    const repo = 'my-org/my-repo';
    const reason = 'Inconsistencies detected';

    // Act
    const action: EnforcementAction = {
      type: 'block_pr',
      prNumber,
      repo,
      reason,
    };

    // Assert
    if (action.type === 'block_pr') {
      expect(action.prNumber).toBe(42);
      expect(action.repo).toBe('my-org/my-repo');
      expect(action.reason).toBe('Inconsistencies detected');
    }
  });

  it('should accept zero as prNumber', () => {
    // Arrange & Act
    const action: EnforcementAction = {
      type: 'block_pr',
      prNumber: 0,
      repo: 'org/repo',
      reason: 'test',
    };

    // Assert
    if (action.type === 'block_pr') {
      expect(action.prNumber).toBe(0);
    }
  });

  it('should accept negative prNumber (no runtime constraint)', () => {
    // Arrange & Act
    const action: EnforcementAction = {
      type: 'block_pr',
      prNumber: -1,
      repo: 'org/repo',
      reason: 'test',
    };

    // Assert
    if (action.type === 'block_pr') {
      expect(action.prNumber).toBe(-1);
    }
  });
});

// ---------------------------------------------------------------------------
// AddCommentAction
// ---------------------------------------------------------------------------

describe('AddCommentAction', () => {
  it('should create a valid add_comment action for jira target', () => {
    // Arrange & Act
    const action: EnforcementAction = {
      type: 'add_comment',
      target: 'jira',
      body: 'This ticket has been blocked due to quality gate failure.',
    };

    // Assert
    if (action.type === 'add_comment') {
      expect(action.target).toBe('jira');
      expect(action.body).toContain('blocked');
    }
  });

  it('should create a valid add_comment action for github target', () => {
    // Arrange & Act
    const action: EnforcementAction = {
      type: 'add_comment',
      target: 'github',
      body: 'PR check failed.',
    };

    // Assert
    if (action.type === 'add_comment' && action.target === 'github') {
      expect(action.body).toBe('PR check failed.');
    }
  });

  it('should accept empty body', () => {
    // Arrange & Act
    const action: EnforcementAction = {
      type: 'add_comment',
      target: 'jira',
      body: '',
    };

    // Assert
    if (action.type === 'add_comment') {
      expect(action.body).toBe('');
    }
  });

  it('should support target narrowing in conditional', () => {
    // Arrange
    const action: EnforcementAction = {
      type: 'add_comment',
      target: 'github',
      body: 'test',
    };

    // Act & Assert
    if (action.type === 'add_comment' && action.target === 'github') {
      // TypeScript narrows both type and target here
      expect(action.target).toBe('github');
    }
  });
});

// ---------------------------------------------------------------------------
// FlagInconsistencyAction
// ---------------------------------------------------------------------------

describe('FlagInconsistencyAction', () => {
  it('should create a valid flag_inconsistency action', () => {
    // Arrange
    const inconsistency = createTestInconsistency();

    // Act
    const action: EnforcementAction = {
      type: 'flag_inconsistency',
      inconsistency,
    };

    // Assert
    if (action.type === 'flag_inconsistency') {
      expect(action.inconsistency.id).toBe('inc-001');
      expect(action.inconsistency.type).toBe('contradiction');
      expect(action.inconsistency.severity).toBe('critical');
    }
  });

  it('should carry full Inconsistency with optional fields', () => {
    // Arrange
    const inconsistency = createTestInconsistency({
      id: 'inc-full',
      relatedDocs: ['doc-a', 'doc-b'],
      suggestion: 'Fix the issue',
    });

    // Act
    const action: EnforcementAction = {
      type: 'flag_inconsistency',
      inconsistency,
    };

    // Assert
    if (action.type === 'flag_inconsistency') {
      expect(action.inconsistency.relatedDocs).toEqual(['doc-a', 'doc-b']);
      expect(action.inconsistency.suggestion).toBe('Fix the issue');
    }
  });
});

// ---------------------------------------------------------------------------
// Discriminated union narrowing across all variants
// ---------------------------------------------------------------------------

describe('Discriminated union narrowing', () => {
  it('should correctly narrow each action type from a mixed array', () => {
    // Arrange
    const inconsistency = createTestInconsistency();
    const actions: readonly EnforcementAction[] = [
      { type: 'block_transition', transitionId: 't1', reason: 'r1' },
      { type: 'block_pr', prNumber: 1, repo: 'repo', reason: 'r2' },
      { type: 'add_comment', target: 'jira', body: 'b' },
      { type: 'flag_inconsistency', inconsistency },
      { type: 'add_comment', target: 'github', body: 'gh comment' },
    ];

    // Act
    const transitionActions = actions.filter((a) => a.type === 'block_transition');
    const prActions = actions.filter((a) => a.type === 'block_pr');
    const commentActions = actions.filter((a) => a.type === 'add_comment');
    const flagActions = actions.filter((a) => a.type === 'flag_inconsistency');

    // Assert
    expect(transitionActions).toHaveLength(1);
    expect(prActions).toHaveLength(1);
    expect(commentActions).toHaveLength(2);
    expect(flagActions).toHaveLength(1);
  });

  it('should access variant-specific properties after narrowing', () => {
    // Arrange
    const action: EnforcementAction = {
      type: 'block_transition',
      transitionId: 'trans-42',
      reason: 'low score',
    };

    // Act
    let transitionId: string | null = null;
    if (action.type === 'block_transition') {
      transitionId = action.transitionId;
    }

    // Assert
    expect(transitionId).toBe('trans-42');
  });

  it('should not expose variant-specific properties on wrong variant', () => {
    // Arrange
    const action: EnforcementAction = {
      type: 'add_comment',
      target: 'jira',
      body: 'test',
    };

    // Act & Assert
    expect(action.type).toBe('add_comment');
    // After narrowing, only add_comment properties are available
    if (action.type === 'add_comment') {
      expect('target' in action).toBe(true);
      expect('body' in action).toBe(true);
      expect('transitionId' in action).toBe(false);
      expect('prNumber' in action).toBe(false);
    }
  });

  it('should handle switch exhaustiveness over action types', () => {
    // Arrange
    const actions: readonly EnforcementAction[] = [
      { type: 'block_transition', transitionId: 't1', reason: 'r1' },
      { type: 'block_pr', prNumber: 10, repo: 'repo', reason: 'r2' },
      { type: 'add_comment', target: 'jira', body: 'body' },
      { type: 'flag_inconsistency', inconsistency: createTestInconsistency() },
    ];

    // Act
    const typeLabels: string[] = [];
    for (const action of actions) {
      switch (action.type) {
        case 'block_transition':
          typeLabels.push(`transition:${action.transitionId}`);
          break;
        case 'block_pr':
          typeLabels.push(`pr:${action.prNumber}`);
          break;
        case 'add_comment':
          typeLabels.push(`comment:${action.target}`);
          break;
        case 'flag_inconsistency':
          typeLabels.push(`flag:${action.inconsistency.id}`);
          break;
      }
    }

    // Assert
    expect(typeLabels).toEqual(['transition:t1', 'pr:10', 'comment:jira', 'flag:inc-001']);
  });
});
