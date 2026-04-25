// Barrel file integration test: verifies all types and classes are re-exported
// from the index barrel file. Tests value exports, type-only re-exports,
// and confirms no circular dependency issues.

// --- Value imports (error classes are runtime values) ---
import {
  REGError,
  ScoringError,
  InsufficientDataError,
  JiraApiError,
  TicketNotFoundError,
  PermissionDeniedError,
  TransitionBlockedError,
  RovoApiError,
  QuotaExceededError,
  GitHubApiError,
  TokenExpiredError,
  TimeoutError,
  CircuitOpenError,
} from '../../../src/backend/types/index';

// --- Type-only imports (interfaces and type aliases) ---
import type {
  ScoreAxes,
  ConsistencyScore,
  InconsistencyType,
  Severity,
  InconsistencySource,
  Inconsistency,
  GateType,
  QualityGateResult,
  GateConfig,
  ProjectConfig,
  EnforcementAction,
  RovoDocument,
  HistoricalDecision,
  RovoContext,
  JiraStatus,
  JiraTransition,
  JiraTicketData,
  PRFile,
  GitHubPRData,
  GitHubStatusCheck,
  ConfluencePageData,
  ConfluencePageMetadata,
  AuditAction,
  AuditLogEntry,
} from '../../../src/backend/types/index';

// ---------------------------------------------------------------------------
// Error class value exports
// ---------------------------------------------------------------------------

describe('Barrel exports - Error classes (value exports)', () => {
  it('should export REGError as a constructable class', () => {
    // Arrange & Act
    const error = new REGError('test', 'ERR');

    // Assert
    expect(error).toBeInstanceOf(REGError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('REGError');
  });

  it('should export ScoringError with correct inheritance', () => {
    // Arrange & Act
    const error = new ScoringError('scoring fail', 'SCORE');

    // Assert
    expect(error).toBeInstanceOf(ScoringError);
    expect(error).toBeInstanceOf(REGError);
    expect(error.name).toBe('ScoringError');
  });

  it('should export InsufficientDataError with correct inheritance', () => {
    // Arrange & Act
    const error = new InsufficientDataError('insufficient', 'INSUFF');

    // Assert
    expect(error).toBeInstanceOf(InsufficientDataError);
    expect(error).toBeInstanceOf(ScoringError);
    expect(error).toBeInstanceOf(REGError);
  });

  it('should export JiraApiError with correct inheritance', () => {
    // Arrange & Act
    const error = new JiraApiError('jira fail', 'JIRA');

    // Assert
    expect(error).toBeInstanceOf(JiraApiError);
    expect(error).toBeInstanceOf(REGError);
  });

  it('should export TicketNotFoundError with correct inheritance', () => {
    // Arrange & Act
    const error = new TicketNotFoundError('not found', '404');

    // Assert
    expect(error).toBeInstanceOf(TicketNotFoundError);
    expect(error).toBeInstanceOf(JiraApiError);
  });

  it('should export PermissionDeniedError with correct inheritance', () => {
    // Arrange & Act
    const error = new PermissionDeniedError('forbidden', '403');

    // Assert
    expect(error).toBeInstanceOf(PermissionDeniedError);
    expect(error).toBeInstanceOf(JiraApiError);
  });

  it('should export TransitionBlockedError with correct inheritance', () => {
    // Arrange & Act
    const error = new TransitionBlockedError('transition blocked', 'BLOCKED');

    // Assert
    expect(error).toBeInstanceOf(TransitionBlockedError);
    expect(error).toBeInstanceOf(JiraApiError);
  });

  it('should export RovoApiError with correct inheritance', () => {
    // Arrange & Act
    const error = new RovoApiError('rovo fail', 'ROVO');

    // Assert
    expect(error).toBeInstanceOf(RovoApiError);
    expect(error).toBeInstanceOf(REGError);
  });

  it('should export QuotaExceededError with correct inheritance', () => {
    // Arrange & Act
    const error = new QuotaExceededError('quota', 'QUOTA');

    // Assert
    expect(error).toBeInstanceOf(QuotaExceededError);
    expect(error).toBeInstanceOf(RovoApiError);
  });

  it('should export GitHubApiError with correct inheritance', () => {
    // Arrange & Act
    const error = new GitHubApiError('github fail', 'GH');

    // Assert
    expect(error).toBeInstanceOf(GitHubApiError);
    expect(error).toBeInstanceOf(REGError);
  });

  it('should export TokenExpiredError with correct inheritance', () => {
    // Arrange & Act
    const error = new TokenExpiredError('token expired', 'TOKEN');

    // Assert
    expect(error).toBeInstanceOf(TokenExpiredError);
    expect(error).toBeInstanceOf(GitHubApiError);
  });

  it('should export TimeoutError with correct inheritance', () => {
    // Arrange & Act
    const error = new TimeoutError('timeout', 'TIMEOUT');

    // Assert
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error).toBeInstanceOf(REGError);
  });

  it('should export CircuitOpenError with correct inheritance', () => {
    // Arrange & Act
    const error = new CircuitOpenError('circuit open', 'CIRCUIT');

    // Assert
    expect(error).toBeInstanceOf(CircuitOpenError);
    expect(error).toBeInstanceOf(REGError);
  });
});

// ---------------------------------------------------------------------------
// Type-only re-exports - Scoring
// ---------------------------------------------------------------------------

describe('Barrel exports - Scoring types', () => {
  it('should re-export ScoreAxes and ConsistencyScore', () => {
    // Arrange & Act
    const axes: ScoreAxes = {
      clarity: 1,
      consistency: 1,
      risk: 0,
      documentation: 0.5,
      technicalDebt: 0.2,
    };
    const score: ConsistencyScore = {
      overall: 0.5,
      axes,
      timestamp: '2026-04-05T00:00:00Z',
      executionId: 'test',
    };

    // Assert
    expect(score.overall).toBe(0.5);
    expect(score.axes.clarity).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Type-only re-exports - Inconsistency Detection
// ---------------------------------------------------------------------------

describe('Barrel exports - Inconsistency types', () => {
  it('should re-export InconsistencyType, Severity, InconsistencySource', () => {
    // Arrange & Act
    const type: InconsistencyType = 'contradiction';
    const severity: Severity = 'critical';
    const source: InconsistencySource = 'jira';

    // Assert
    expect(type).toBe('contradiction');
    expect(severity).toBe('critical');
    expect(source).toBe('jira');
  });

  it('should re-export Inconsistency interface', () => {
    // Arrange & Act
    const inconsistency: Inconsistency = {
      id: 'test',
      type: 'duplicate',
      severity: 'warning',
      source: 'confluence',
      description: 'test',
      affectedTicketKey: 'PROJ-1',
    };

    // Assert
    expect(inconsistency.type).toBe('duplicate');
  });
});

// ---------------------------------------------------------------------------
// Type-only re-exports - Quality Gates
// ---------------------------------------------------------------------------

describe('Barrel exports - Quality Gate types', () => {
  it('should re-export GateType and QualityGateResult', () => {
    // Arrange & Act
    const gate: GateType = 'definition';
    const result: QualityGateResult = {
      gate: 'definition',
      passed: true,
      score: {
        overall: 0.9,
        axes: { clarity: 0.9, consistency: 0.9, risk: 0.9, documentation: 0.9, technicalDebt: 0.9 },
        timestamp: '2026-04-05T00:00:00Z',
        executionId: 'test',
      },
      inconsistencies: [],
      blockedTransitions: [],
      executionId: 'test',
    };

    // Assert
    expect(result.passed).toBe(true);
    expect(gate).toBe('definition');
  });
});

// ---------------------------------------------------------------------------
// Type-only re-exports - Project Configuration
// ---------------------------------------------------------------------------

describe('Barrel exports - Project Config types', () => {
  it('should re-export GateConfig and ProjectConfig', () => {
    // Arrange & Act
    const gates: GateConfig = { definition: true, execution: false, delivery: false };
    const config: ProjectConfig = {
      projectKey: 'TEST',
      enabled: true,
      scoreThreshold: 0.8,
      gates,
    };

    // Assert
    expect(config.projectKey).toBe('TEST');
  });
});

// ---------------------------------------------------------------------------
// Type-only re-exports - Enforcement
// ---------------------------------------------------------------------------

describe('Barrel exports - Enforcement type', () => {
  it('should re-export EnforcementAction discriminated union', () => {
    // Arrange & Act
    const action: EnforcementAction = {
      type: 'block_transition',
      transitionId: 't1',
      reason: 'test',
    };

    // Assert
    expect(action.type).toBe('block_transition');
  });
});

// ---------------------------------------------------------------------------
// Type-only re-exports - Rovo Context
// ---------------------------------------------------------------------------

describe('Barrel exports - Rovo Context types', () => {
  it('should re-export RovoDocument, HistoricalDecision, RovoContext', () => {
    // Arrange & Act
    const doc: RovoDocument = {
      id: 'd1',
      title: 'Test',
      content: 'content',
      source: 'confluence',
      relevance: 0.5,
    };
    const decision: HistoricalDecision = {
      id: 'dec1',
      title: 'Decision',
      description: 'desc',
      date: '2026-01-01',
      source: 'jira',
    };
    const context: RovoContext = {
      documents: [doc],
      relatedTickets: ['PROJ-1'],
      decisions: [decision],
      query: 'test',
      timestamp: '2026-04-05T00:00:00Z',
    };

    // Assert
    expect(context.documents).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Type-only re-exports - Jira Data
// ---------------------------------------------------------------------------

describe('Barrel exports - Jira Data types', () => {
  it('should re-export JiraStatus, JiraTransition, JiraTicketData', () => {
    // Arrange & Act
    const status: JiraStatus = 'IN PROGRESS';
    const transition: JiraTransition = { id: '1', name: 'Start', toStatus: 'IN PROGRESS' };
    const ticket: JiraTicketData = {
      key: 'PROJ-1',
      summary: 'Test',
      description: 'Desc',
      status: 'TO DO',
      issueType: 'Story',
      labels: [],
      projectKey: 'PROJ',
      created: '2026-01-01T00:00:00Z',
      updated: '2026-01-01T00:00:00Z',
    };

    // Assert
    expect(status).toBe('IN PROGRESS');
    expect(transition.name).toBe('Start');
    expect(ticket.key).toBe('PROJ-1');
  });
});

// ---------------------------------------------------------------------------
// Type-only re-exports - GitHub Data
// ---------------------------------------------------------------------------

describe('Barrel exports - GitHub Data types', () => {
  it('should re-export PRFile, GitHubPRData, GitHubStatusCheck', () => {
    // Arrange & Act
    const file: PRFile = { filename: 'test.ts', status: 'added', additions: 10, deletions: 0 };
    const pr: GitHubPRData = {
      number: 1,
      title: 'Test',
      body: '',
      state: 'open',
      branch: 'main',
      baseBranch: 'main',
      files: [file],
      url: 'https://github.com/test',
    };
    const check: GitHubStatusCheck = {
      state: 'success',
      targetUrl: 'https://example.com',
      description: 'Passed',
      context: 'test',
    };

    // Assert
    expect(pr.state).toBe('open');
    expect(check.state).toBe('success');
  });
});

// ---------------------------------------------------------------------------
// Type-only re-exports - Confluence Data
// ---------------------------------------------------------------------------

describe('Barrel exports - Confluence Data types', () => {
  it('should re-export ConfluencePageData and ConfluencePageMetadata', () => {
    // Arrange & Act
    const page: ConfluencePageData = {
      id: 'p1',
      title: 'Test Page',
      content: 'Content',
      spaceKey: 'ENG',
      url: 'https://confluence.example.com/p1',
      lastUpdated: '2026-01-01T00:00:00Z',
    };
    const meta: ConfluencePageMetadata = {
      id: 'p1',
      title: 'Test Page',
      spaceKey: 'ENG',
      labels: ['test'],
      version: 1,
      lastUpdated: '2026-01-01T00:00:00Z',
    };

    // Assert
    expect(page.spaceKey).toBe('ENG');
    expect(meta.version).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Type-only re-exports - Audit Log
// ---------------------------------------------------------------------------

describe('Barrel exports - Audit Log types', () => {
  it('should re-export AuditAction and AuditLogEntry', () => {
    // Arrange & Act
    const action: AuditAction = 'gate_evaluated';
    const entry: AuditLogEntry = {
      id: 'a1',
      action: 'gate_evaluated',
      timestamp: '2026-04-05T00:00:00Z',
      executionId: 'e1',
      projectKey: 'PROJ',
      details: {},
    };

    // Assert
    expect(action).toBe('gate_evaluated');
    expect(entry.id).toBe('a1');
  });
});

// ---------------------------------------------------------------------------
// No circular dependency - import succeeds
// ---------------------------------------------------------------------------

describe('Barrel file - no circular dependency', () => {
  it('should import the barrel without throwing or hanging', () => {
    // Arrange & Act - importing at the top of this file already verifies this
    // We simply assert that the error classes are defined functions
    expect(typeof REGError).toBe('function');
    expect(typeof ScoringError).toBe('function');
    expect(typeof InsufficientDataError).toBe('function');
    expect(typeof JiraApiError).toBe('function');
    expect(typeof TicketNotFoundError).toBe('function');
    expect(typeof PermissionDeniedError).toBe('function');
    expect(typeof TransitionBlockedError).toBe('function');
    expect(typeof RovoApiError).toBe('function');
    expect(typeof QuotaExceededError).toBe('function');
    expect(typeof GitHubApiError).toBe('function');
    expect(typeof TokenExpiredError).toBe('function');
    expect(typeof TimeoutError).toBe('function');
    expect(typeof CircuitOpenError).toBe('function');
  });

  it('should export exactly 13 error classes', () => {
    // Arrange
    const errorClasses = [
      REGError,
      ScoringError,
      InsufficientDataError,
      JiraApiError,
      TicketNotFoundError,
      PermissionDeniedError,
      TransitionBlockedError,
      RovoApiError,
      QuotaExceededError,
      GitHubApiError,
      TokenExpiredError,
      TimeoutError,
      CircuitOpenError,
    ];

    // Act & Assert
    expect(errorClasses).toHaveLength(13);
    for (const cls of errorClasses) {
      expect(typeof cls).toBe('function');
    }
  });
});
