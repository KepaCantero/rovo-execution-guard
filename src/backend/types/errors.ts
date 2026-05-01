// [ARCH-SOLID-058] Domain error hierarchy — zero framework dependencies
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-053] Domain-specific error types, never generic Error

export class REGError extends Error {
  public readonly code: string;
  public readonly executionId?: string;

  constructor(message: string, code: string, executionId?: string) {
    super(message);
    this.name = 'REGError';
    this.code = code;
    this.executionId = executionId;
  }
}

export class ScoringError extends REGError {
  constructor(message: string, code: string, executionId?: string) {
    super(message, code, executionId);
    this.name = 'ScoringError';
  }
}

export class InsufficientDataError extends ScoringError {
  constructor(message: string, code: string, executionId?: string) {
    super(message, code, executionId);
    this.name = 'InsufficientDataError';
  }
}

export class JiraApiError extends REGError {
  constructor(message: string, code: string, executionId?: string) {
    super(message, code, executionId);
    this.name = 'JiraApiError';
  }
}

export class TicketNotFoundError extends JiraApiError {
  constructor(message: string, code: string, executionId?: string) {
    super(message, code, executionId);
    this.name = 'TicketNotFoundError';
  }
}

// [ARCH-SOLID-053] Domain-specific error for HTTP 403 responses
export class PermissionDeniedError extends JiraApiError {
  constructor(message: string, code: string, executionId?: string) {
    super(message, code, executionId);
    this.name = 'PermissionDeniedError';
  }
}

// [ARCH-SOLID-053] Domain-specific error for disallowed transitions
export class TransitionBlockedError extends JiraApiError {
  constructor(message: string, code: string, executionId?: string) {
    super(message, code, executionId);
    this.name = 'TransitionBlockedError';
  }
}

export class RovoApiError extends REGError {
  constructor(message: string, code: string, executionId?: string) {
    super(message, code, executionId);
    this.name = 'RovoApiError';
  }
}

export class QuotaExceededError extends RovoApiError {
  constructor(message: string, code: string, executionId?: string) {
    super(message, code, executionId);
    this.name = 'QuotaExceededError';
  }
}

export class GitHubApiError extends REGError {
  constructor(message: string, code: string, executionId?: string) {
    super(message, code, executionId);
    this.name = 'GitHubApiError';
  }
}

export class TokenExpiredError extends GitHubApiError {
  constructor(message: string, code: string, executionId?: string) {
    super(message, code, executionId);
    this.name = 'TokenExpiredError';
  }
}

export class ConfluenceApiError extends REGError {
  constructor(message: string, code: string, executionId?: string) {
    super(message, code, executionId);
    this.name = 'ConfluenceApiError';
  }
}

// [ARCH-SOLID-053] Domain-specific error for missing Confluence pages
export class PageNotFoundError extends ConfluenceApiError {
  constructor(message: string, code: string, executionId?: string) {
    super(message, code, executionId);
    this.name = 'PageNotFoundError';
  }
}

// [ARCH-SOLID-053] Domain-specific error for missing Confluence spaces
export class SpaceNotFoundError extends ConfluenceApiError {
  constructor(message: string, code: string, executionId?: string) {
    super(message, code, executionId);
    this.name = 'SpaceNotFoundError';
  }
}

export class TimeoutError extends REGError {
  constructor(message: string, code: string, executionId?: string) {
    super(message, code, executionId);
    this.name = 'TimeoutError';
  }
}

export class CircuitOpenError extends REGError {
  constructor(message: string, code: string, executionId?: string) {
    super(message, code, executionId);
    this.name = 'CircuitOpenError';
  }
}

// [ARCH-SOLID-053] Domain-specific error for Forge Storage operations
export class StorageError extends REGError {
  public readonly key?: string;

  constructor(message: string, code: string, executionId?: string, key?: string) {
    super(message, code, executionId);
    this.name = 'StorageError';
    this.key = key;
  }
}
