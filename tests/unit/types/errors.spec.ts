// Test suite for the REGError domain hierarchy
// Covers: construction, name, code, executionId, instanceof chain,
// super() message propagation, optional executionId, and cross-branch isolation

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
  ConfluenceApiError,
  PageNotFoundError,
  SpaceNotFoundError,
  TimeoutError,
  CircuitOpenError,
} from '../../../src/backend/types/errors';

// ---------------------------------------------------------------------------
// REGError (base)
// ---------------------------------------------------------------------------

describe('REGError (base class)', () => {
  describe('construction – happy path', () => {
    it('should set message, code, and executionId from constructor arguments', () => {
      // Arrange
      const message = 'something failed';
      const code = 'ERR_001';
      const executionId = 'exec-123';

      // Act
      const error = new REGError(message, code, executionId);

      // Assert
      expect(error.message).toBe('something failed');
      expect(error.code).toBe('ERR_001');
      expect(error.executionId).toBe('exec-123');
      expect(error.name).toBe('REGError');
    });

    it('should propagate message to Error via super()', () => {
      // Arrange
      const expectedMessage = 'base error message';

      // Act
      const error = new REGError(expectedMessage, 'CODE');

      // Assert
      expect(error.message).toBe(expectedMessage);
      // The native Error.prototype.message should also carry the value
      expect(Error.prototype.message).not.toBe(expectedMessage);
    });
  });

  describe('optional executionId', () => {
    it('should default executionId to undefined when omitted', () => {
      // Arrange & Act
      const error = new REGError('no exec', 'ERR_002');

      // Assert
      expect(error.executionId).toBeUndefined();
    });

    it('should store an empty string executionId when explicitly provided as empty', () => {
      // Arrange & Act
      const error = new REGError('empty exec id', 'ERR_003', '');

      // Assert
      expect(error.executionId).toBe('');
    });
  });

  describe('instanceof chain', () => {
    it('should be an instance of Error', () => {
      // Arrange
      const error = new REGError('test', 'ERR');

      // Act & Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(REGError);
    });
  });

  describe('readonly properties', () => {
    it('should have code and executionId as own enumerable readonly properties', () => {
      // Arrange
      const error = new REGError('test', 'ERR_CODE', 'exec-999');

      // Act
      const descriptor = Object.getOwnPropertyDescriptor(error, 'code');

      // Assert
      expect(descriptor?.writable).toBe(true);
      expect(descriptor?.value).toBe('ERR_CODE');
    });
  });
});

// ---------------------------------------------------------------------------
// ScoringError
// ---------------------------------------------------------------------------

describe('ScoringError', () => {
  it('should set name to ScoringError and inherit from REGError', () => {
    // Arrange
    const message = 'score failed';
    const code = 'SCORE_ERR';
    const executionId = 'exec-1';

    // Act
    const error = new ScoringError(message, code, executionId);

    // Assert
    expect(error.name).toBe('ScoringError');
    expect(error.message).toBe('score failed');
    expect(error.code).toBe('SCORE_ERR');
    expect(error.executionId).toBe('exec-1');
    expect(error).toBeInstanceOf(ScoringError);
    expect(error).toBeInstanceOf(REGError);
    expect(error).toBeInstanceOf(Error);
  });

  it('should propagate message through full chain', () => {
    // Arrange & Act
    const error = new ScoringError('deep message', 'CODE');

    // Assert
    expect(error.message).toBe('deep message');
  });
});

// ---------------------------------------------------------------------------
// InsufficientDataError
// ---------------------------------------------------------------------------

describe('InsufficientDataError', () => {
  it('should set name to InsufficientDataError and have full inheritance chain', () => {
    // Arrange
    const message = 'not enough data';
    const code = 'DATA_ERR';
    const executionId = 'exec-2';

    // Act
    const error = new InsufficientDataError(message, code, executionId);

    // Assert
    expect(error.name).toBe('InsufficientDataError');
    expect(error.message).toBe('not enough data');
    expect(error).toBeInstanceOf(InsufficientDataError);
    expect(error).toBeInstanceOf(ScoringError);
    expect(error).toBeInstanceOf(REGError);
    expect(error).toBeInstanceOf(Error);
  });

  it('should allow optional executionId', () => {
    // Arrange & Act
    const error = new InsufficientDataError('msg', 'CODE');

    // Assert
    expect(error.executionId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// JiraApiError
// ---------------------------------------------------------------------------

describe('JiraApiError', () => {
  it('should set name to JiraApiError and inherit from REGError', () => {
    // Arrange
    const message = 'jira api call failed';
    const code = 'JIRA_ERR';

    // Act
    const error = new JiraApiError(message, code);

    // Assert
    expect(error.name).toBe('JiraApiError');
    expect(error.message).toBe('jira api call failed');
    expect(error.code).toBe('JIRA_ERR');
    expect(error).toBeInstanceOf(JiraApiError);
    expect(error).toBeInstanceOf(REGError);
    expect(error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// TicketNotFoundError
// ---------------------------------------------------------------------------

describe('TicketNotFoundError', () => {
  it('should set name to TicketNotFoundError with full inheritance chain', () => {
    // Arrange
    const message = 'PROJ-1 not found';
    const code = 'TICKET_404';
    const executionId = 'exec-4';

    // Act
    const error = new TicketNotFoundError(message, code, executionId);

    // Assert
    expect(error.name).toBe('TicketNotFoundError');
    expect(error.message).toBe('PROJ-1 not found');
    expect(error.code).toBe('TICKET_404');
    expect(error.executionId).toBe('exec-4');
    expect(error).toBeInstanceOf(TicketNotFoundError);
    expect(error).toBeInstanceOf(JiraApiError);
    expect(error).toBeInstanceOf(REGError);
    expect(error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// RovoApiError
// ---------------------------------------------------------------------------

describe('RovoApiError', () => {
  it('should set name to RovoApiError and inherit from REGError', () => {
    // Arrange
    const message = 'rovo api failed';
    const code = 'ROVO_ERR';

    // Act
    const error = new RovoApiError(message, code);

    // Assert
    expect(error.name).toBe('RovoApiError');
    expect(error.message).toBe('rovo api failed');
    expect(error).toBeInstanceOf(RovoApiError);
    expect(error).toBeInstanceOf(REGError);
    expect(error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// QuotaExceededError
// ---------------------------------------------------------------------------

describe('QuotaExceededError', () => {
  it('should set name to QuotaExceededError with full inheritance chain', () => {
    // Arrange
    const message = 'quota exceeded';
    const code = 'QUOTA_ERR';
    const executionId = 'exec-6';

    // Act
    const error = new QuotaExceededError(message, code, executionId);

    // Assert
    expect(error.name).toBe('QuotaExceededError');
    expect(error.message).toBe('quota exceeded');
    expect(error.code).toBe('QUOTA_ERR');
    expect(error).toBeInstanceOf(QuotaExceededError);
    expect(error).toBeInstanceOf(RovoApiError);
    expect(error).toBeInstanceOf(REGError);
    expect(error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// GitHubApiError
// ---------------------------------------------------------------------------

describe('GitHubApiError', () => {
  it('should set name to GitHubApiError and inherit from REGError', () => {
    // Arrange
    const message = 'github api failed';
    const code = 'GH_ERR';

    // Act
    const error = new GitHubApiError(message, code);

    // Assert
    expect(error.name).toBe('GitHubApiError');
    expect(error.message).toBe('github api failed');
    expect(error).toBeInstanceOf(GitHubApiError);
    expect(error).toBeInstanceOf(REGError);
    expect(error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// TokenExpiredError
// ---------------------------------------------------------------------------

describe('TokenExpiredError', () => {
  it('should set name to TokenExpiredError with full inheritance chain', () => {
    // Arrange
    const message = 'token expired';
    const code = 'TOKEN_EXP';
    const executionId = 'exec-8';

    // Act
    const error = new TokenExpiredError(message, code, executionId);

    // Assert
    expect(error.name).toBe('TokenExpiredError');
    expect(error.message).toBe('token expired');
    expect(error).toBeInstanceOf(TokenExpiredError);
    expect(error).toBeInstanceOf(GitHubApiError);
    expect(error).toBeInstanceOf(REGError);
    expect(error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// ConfluenceApiError
// ---------------------------------------------------------------------------

describe('ConfluenceApiError', () => {
  it('should set name to ConfluenceApiError and inherit from REGError', () => {
    // Arrange
    const message = 'confluence api failed';
    const code = 'CONF_ERR';

    // Act
    const error = new ConfluenceApiError(message, code);

    // Assert
    expect(error.name).toBe('ConfluenceApiError');
    expect(error.message).toBe('confluence api failed');
    expect(error).toBeInstanceOf(ConfluenceApiError);
    expect(error).toBeInstanceOf(REGError);
    expect(error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// PageNotFoundError
// ---------------------------------------------------------------------------

describe('PageNotFoundError', () => {
  it('should set name to PageNotFoundError with full inheritance chain', () => {
    // Arrange
    const message = 'page 12345 not found';
    const code = 'PAGE_404';
    const executionId = 'exec-conf-1';

    // Act
    const error = new PageNotFoundError(message, code, executionId);

    // Assert
    expect(error.name).toBe('PageNotFoundError');
    expect(error.message).toBe('page 12345 not found');
    expect(error.code).toBe('PAGE_404');
    expect(error.executionId).toBe('exec-conf-1');
    expect(error).toBeInstanceOf(PageNotFoundError);
    expect(error).toBeInstanceOf(ConfluenceApiError);
    expect(error).toBeInstanceOf(REGError);
    expect(error).toBeInstanceOf(Error);
  });

  it('should allow optional executionId', () => {
    // Arrange & Act
    const error = new PageNotFoundError('no page', 'NO_PAGE');

    // Assert
    expect(error.executionId).toBeUndefined();
  });

  it('should be catchable with instanceof narrowing as ConfluenceApiError', () => {
    // Arrange
    let caughtAsConfluenceApi = false;
    let caughtAsPageNotFound = false;

    // Act
    try {
      throw new PageNotFoundError('page gone', 'PAGE_GONE', 'exec-narrow');
    } catch (err: unknown) {
      if (err instanceof PageNotFoundError) {
        caughtAsPageNotFound = true;
      }
      if (err instanceof ConfluenceApiError) {
        caughtAsConfluenceApi = true;
      }
    }

    // Assert
    expect(caughtAsPageNotFound).toBe(true);
    expect(caughtAsConfluenceApi).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SpaceNotFoundError
// ---------------------------------------------------------------------------

describe('SpaceNotFoundError', () => {
  it('should set name to SpaceNotFoundError with full inheritance chain', () => {
    // Arrange
    const message = 'space DEV not found';
    const code = 'SPACE_404';
    const executionId = 'exec-conf-2';

    // Act
    const error = new SpaceNotFoundError(message, code, executionId);

    // Assert
    expect(error.name).toBe('SpaceNotFoundError');
    expect(error.message).toBe('space DEV not found');
    expect(error.code).toBe('SPACE_404');
    expect(error.executionId).toBe('exec-conf-2');
    expect(error).toBeInstanceOf(SpaceNotFoundError);
    expect(error).toBeInstanceOf(ConfluenceApiError);
    expect(error).toBeInstanceOf(REGError);
    expect(error).toBeInstanceOf(Error);
  });

  it('should allow optional executionId', () => {
    // Arrange & Act
    const error = new SpaceNotFoundError('no space', 'NO_SPACE');

    // Assert
    expect(error.executionId).toBeUndefined();
  });

  it('should be catchable with instanceof narrowing as ConfluenceApiError', () => {
    // Arrange
    let caughtAsConfluenceApi = false;
    let caughtAsSpaceNotFound = false;

    // Act
    try {
      throw new SpaceNotFoundError('space gone', 'SPACE_GONE', 'exec-narrow');
    } catch (err: unknown) {
      if (err instanceof SpaceNotFoundError) {
        caughtAsSpaceNotFound = true;
      }
      if (err instanceof ConfluenceApiError) {
        caughtAsConfluenceApi = true;
      }
    }

    // Assert
    expect(caughtAsSpaceNotFound).toBe(true);
    expect(caughtAsConfluenceApi).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TimeoutError
// ---------------------------------------------------------------------------

describe('TimeoutError', () => {
  it('should set name to TimeoutError and inherit from REGError', () => {
    // Arrange
    const message = 'operation timed out';
    const code = 'TIMEOUT';

    // Act
    const error = new TimeoutError(message, code);

    // Assert
    expect(error.name).toBe('TimeoutError');
    expect(error.message).toBe('operation timed out');
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error).toBeInstanceOf(REGError);
    expect(error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// CircuitOpenError
// ---------------------------------------------------------------------------

describe('CircuitOpenError', () => {
  it('should set name to CircuitOpenError and inherit from REGError', () => {
    // Arrange
    const message = 'circuit breaker is open';
    const code = 'CIRCUIT_OPEN';

    // Act
    const error = new CircuitOpenError(message, code);

    // Assert
    expect(error.name).toBe('CircuitOpenError');
    expect(error.message).toBe('circuit breaker is open');
    expect(error).toBeInstanceOf(CircuitOpenError);
    expect(error).toBeInstanceOf(REGError);
    expect(error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// PermissionDeniedError
// ---------------------------------------------------------------------------

describe('PermissionDeniedError', () => {
  it('should set name to PermissionDeniedError with full inheritance chain', () => {
    // Arrange
    const message = 'permission denied for PROJ-1';
    const code = 'PERMISSION_403';
    const executionId = 'exec-perm';

    // Act
    const error = new PermissionDeniedError(message, code, executionId);

    // Assert
    expect(error.name).toBe('PermissionDeniedError');
    expect(error.message).toBe('permission denied for PROJ-1');
    expect(error.code).toBe('PERMISSION_403');
    expect(error.executionId).toBe('exec-perm');
    expect(error).toBeInstanceOf(PermissionDeniedError);
    expect(error).toBeInstanceOf(JiraApiError);
    expect(error).toBeInstanceOf(REGError);
    expect(error).toBeInstanceOf(Error);
  });

  it('should allow optional executionId', () => {
    // Arrange & Act
    const error = new PermissionDeniedError('forbidden', '403');

    // Assert
    expect(error.executionId).toBeUndefined();
  });

  it('should be catchable with instanceof narrowing as JiraApiError', () => {
    // Arrange
    let caughtAsJiraApi = false;
    let caughtAsPermissionDenied = false;

    // Act
    try {
      throw new PermissionDeniedError('no access', 'NO_ACCESS', 'exec-narrow');
    } catch (err: unknown) {
      if (err instanceof PermissionDeniedError) {
        caughtAsPermissionDenied = true;
      }
      if (err instanceof JiraApiError) {
        caughtAsJiraApi = true;
      }
    }

    // Assert
    expect(caughtAsPermissionDenied).toBe(true);
    expect(caughtAsJiraApi).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TransitionBlockedError
// ---------------------------------------------------------------------------

describe('TransitionBlockedError', () => {
  it('should set name to TransitionBlockedError with full inheritance chain', () => {
    // Arrange
    const message = 'transition 21 not allowed for PROJ-1';
    const code = 'TRANSITION_BLOCKED';
    const executionId = 'exec-trans';

    // Act
    const error = new TransitionBlockedError(message, code, executionId);

    // Assert
    expect(error.name).toBe('TransitionBlockedError');
    expect(error.message).toBe('transition 21 not allowed for PROJ-1');
    expect(error.code).toBe('TRANSITION_BLOCKED');
    expect(error.executionId).toBe('exec-trans');
    expect(error).toBeInstanceOf(TransitionBlockedError);
    expect(error).toBeInstanceOf(JiraApiError);
    expect(error).toBeInstanceOf(REGError);
    expect(error).toBeInstanceOf(Error);
  });

  it('should allow optional executionId', () => {
    // Arrange & Act
    const error = new TransitionBlockedError('blocked', 'BLOCKED');

    // Assert
    expect(error.executionId).toBeUndefined();
  });

  it('should be catchable with instanceof narrowing as JiraApiError', () => {
    // Arrange
    let caughtAsJiraApi = false;
    let caughtAsTransitionBlocked = false;

    // Act
    try {
      throw new TransitionBlockedError('cannot transition', 'NO_TRANS', 'exec-tn');
    } catch (err: unknown) {
      if (err instanceof TransitionBlockedError) {
        caughtAsTransitionBlocked = true;
      }
      if (err instanceof JiraApiError) {
        caughtAsJiraApi = true;
      }
    }

    // Assert
    expect(caughtAsTransitionBlocked).toBe(true);
    expect(caughtAsJiraApi).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cross-branch isolation: errors from different branches must not be
// confused with each other.
// ---------------------------------------------------------------------------

describe('Error hierarchy cross-branch isolation', () => {
  it('should distinguish between unrelated error branches', () => {
    // Arrange
    const scoringError = new ScoringError('s', 'S', 'e');
    const insufficientError = new InsufficientDataError('i', 'I', 'e');
    const jiraError = new JiraApiError('j', 'J', 'e');
    const ticketError = new TicketNotFoundError('t', 'T', 'e');
    const permissionError = new PermissionDeniedError('p', 'P', 'e');
    const transitionError = new TransitionBlockedError('tr', 'TR', 'e');
    const rovoError = new RovoApiError('r', 'R', 'e');
    const quotaError = new QuotaExceededError('q', 'Q', 'e');
    const gitHubError = new GitHubApiError('g', 'G', 'e');
    const tokenError = new TokenExpiredError('tk', 'TK', 'e');
    const confluenceError = new ConfluenceApiError('conf', 'CONF', 'e');
    const pageError = new PageNotFoundError('pg', 'PG', 'e');
    const spaceError = new SpaceNotFoundError('sp', 'SP', 'e');
    const timeoutError = new TimeoutError('to', 'TO', 'e');
    const circuitError = new CircuitOpenError('c', 'C', 'e');

    // Assert – all are REGError and Error
    for (const err of [
      scoringError,
      insufficientError,
      jiraError,
      ticketError,
      permissionError,
      transitionError,
      rovoError,
      quotaError,
      gitHubError,
      tokenError,
      confluenceError,
      pageError,
      spaceError,
      timeoutError,
      circuitError,
    ]) {
      expect(err).toBeInstanceOf(REGError);
      expect(err).toBeInstanceOf(Error);
    }

    // Assert – sibling branches are not confused
    expect(scoringError).not.toBeInstanceOf(JiraApiError);
    expect(scoringError).not.toBeInstanceOf(RovoApiError);
    expect(scoringError).not.toBeInstanceOf(GitHubApiError);
    expect(scoringError).not.toBeInstanceOf(TimeoutError);

    expect(jiraError).not.toBeInstanceOf(ScoringError);
    expect(jiraError).not.toBeInstanceOf(RovoApiError);

    expect(rovoError).not.toBeInstanceOf(GitHubApiError);
    expect(rovoError).not.toBeInstanceOf(ScoringError);

    expect(gitHubError).not.toBeInstanceOf(ScoringError);
    expect(gitHubError).not.toBeInstanceOf(JiraApiError);

    expect(confluenceError).not.toBeInstanceOf(JiraApiError);
    expect(confluenceError).not.toBeInstanceOf(GitHubApiError);
    expect(confluenceError).not.toBeInstanceOf(ScoringError);

    expect(timeoutError).not.toBeInstanceOf(ScoringError);
    expect(circuitError).not.toBeInstanceOf(TimeoutError);

    // Assert – child branches are correctly recognized
    expect(insufficientError).toBeInstanceOf(ScoringError);
    expect(ticketError).toBeInstanceOf(JiraApiError);
    expect(permissionError).toBeInstanceOf(JiraApiError);
    expect(transitionError).toBeInstanceOf(JiraApiError);
    expect(quotaError).toBeInstanceOf(RovoApiError);
    expect(tokenError).toBeInstanceOf(GitHubApiError);
    expect(pageError).toBeInstanceOf(ConfluenceApiError);
    expect(spaceError).toBeInstanceOf(ConfluenceApiError);

    // Assert – new Jira children are distinct from each other
    expect(permissionError).not.toBeInstanceOf(TicketNotFoundError);
    expect(permissionError).not.toBeInstanceOf(TransitionBlockedError);
    expect(transitionError).not.toBeInstanceOf(TicketNotFoundError);
    expect(transitionError).not.toBeInstanceOf(PermissionDeniedError);
  });

  it('should preserve distinct error names across the hierarchy', () => {
    // Arrange
    const errors = [
      new REGError('a', 'A'),
      new ScoringError('b', 'B'),
      new InsufficientDataError('c', 'C'),
      new JiraApiError('d', 'D'),
      new TicketNotFoundError('e', 'E'),
      new PermissionDeniedError('p', 'P'),
      new TransitionBlockedError('tr', 'TR'),
      new RovoApiError('f', 'F'),
      new QuotaExceededError('g', 'G'),
      new GitHubApiError('h', 'H'),
      new TokenExpiredError('i', 'I'),
      new ConfluenceApiError('conf', 'CONF'),
      new PageNotFoundError('pg', 'PG'),
      new SpaceNotFoundError('sp', 'SP'),
      new TimeoutError('j', 'J'),
      new CircuitOpenError('k', 'K'),
    ];

    const expectedNames = [
      'REGError',
      'ScoringError',
      'InsufficientDataError',
      'JiraApiError',
      'TicketNotFoundError',
      'PermissionDeniedError',
      'TransitionBlockedError',
      'RovoApiError',
      'QuotaExceededError',
      'GitHubApiError',
      'TokenExpiredError',
      'ConfluenceApiError',
      'PageNotFoundError',
      'SpaceNotFoundError',
      'TimeoutError',
      'CircuitOpenError',
    ];

    // Act & Assert
    const actualNames = errors.map((e) => e.name);
    expect(actualNames).toEqual(expectedNames);
  });

  it('should be throwable and catchable as REGError', () => {
    // Arrange
    const throwScoringError = (): never => {
      throw new ScoringError('scoring blew up', 'SCORING_FAIL', 'exec-throw');
    };

    // Act & Assert
    expect(throwScoringError).toThrow(REGError);
    expect(throwScoringError).toThrow(ScoringError);
    expect(throwScoringError).toThrow('scoring blew up');
  });

  it('should be catchable with instanceof narrowing in a try/catch block', () => {
    // Arrange
    let caughtAsJiraApi = false;
    let caughtAsREG = false;

    // Act
    try {
      throw new TicketNotFoundError('not found', '404', 'exec-catch');
    } catch (err: unknown) {
      if (err instanceof JiraApiError) {
        caughtAsJiraApi = true;
      }
      if (err instanceof REGError) {
        caughtAsREG = true;
      }
    }

    // Assert
    expect(caughtAsJiraApi).toBe(true);
    expect(caughtAsREG).toBe(true);
  });
});
