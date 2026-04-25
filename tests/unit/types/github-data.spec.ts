// Test suite for PRFile, GitHubPRData, and GitHubStatusCheck domain types
// Covers: PR file statuses, PR states, status check states, nested structures
// Tests: happy path, edge cases, discriminated union narrowing, readonly arrays

import type {
  PRFile,
  GitHubPRData,
  GitHubStatusCheck,
} from '../../../src/backend/types/github-data';

// ---------------------------------------------------------------------------
// PRFile
// ---------------------------------------------------------------------------

describe('PRFile', () => {
  describe('happy path – all valid statuses', () => {
    it('should accept all three file statuses', () => {
      // Arrange & Act
      const added: PRFile = { filename: 'new.ts', status: 'added', additions: 10, deletions: 0 };
      const modified: PRFile = {
        filename: 'changed.ts',
        status: 'modified',
        additions: 5,
        deletions: 3,
      };
      const removed: PRFile = {
        filename: 'old.ts',
        status: 'removed',
        additions: 0,
        deletions: 15,
      };

      // Assert
      expect(added.status).toBe('added');
      expect(modified.status).toBe('modified');
      expect(removed.status).toBe('removed');
    });
  });

  describe('edge cases', () => {
    it('should accept zero additions and deletions', () => {
      // Arrange & Act
      const file: PRFile = { filename: 'empty.ts', status: 'added', additions: 0, deletions: 0 };

      // Assert
      expect(file.additions).toBe(0);
      expect(file.deletions).toBe(0);
    });

    it('should accept large addition and deletion counts', () => {
      // Arrange & Act
      const file: PRFile = {
        filename: 'big.ts',
        status: 'modified',
        additions: 10000,
        deletions: 5000,
      };

      // Assert
      expect(file.additions).toBe(10000);
      expect(file.deletions).toBe(5000);
    });

    it('should accept empty filename', () => {
      // Arrange & Act
      const file: PRFile = { filename: '', status: 'added', additions: 1, deletions: 0 };

      // Assert
      expect(file.filename).toBe('');
    });

    it('should narrow by status in a conditional', () => {
      // Arrange
      const file: PRFile = { filename: 'test.ts', status: 'removed', additions: 0, deletions: 10 };

      // Act & Assert
      if (file.status === 'removed') {
        expect(file.deletions).toBe(10);
      }
    });

    it('should filter files by status from a mixed array', () => {
      // Arrange
      const files: readonly PRFile[] = [
        { filename: 'a.ts', status: 'added', additions: 5, deletions: 0 },
        { filename: 'b.ts', status: 'modified', additions: 2, deletions: 1 },
        { filename: 'c.ts', status: 'removed', additions: 0, deletions: 3 },
        { filename: 'd.ts', status: 'added', additions: 10, deletions: 0 },
      ];

      // Act
      const added = files.filter((f) => f.status === 'added');

      // Assert
      expect(added).toHaveLength(2);
    });
  });
});

// ---------------------------------------------------------------------------
// GitHubPRData
// ---------------------------------------------------------------------------

describe('GitHubPRData', () => {
  describe('happy path', () => {
    it('should accept all valid PR states', () => {
      // Arrange
      const states: Array<GitHubPRData['state']> = ['open', 'closed', 'merged'];

      // Assert
      expect(states).toHaveLength(3);
      expect(states).toContain('open');
      expect(states).toContain('closed');
      expect(states).toContain('merged');
    });

    it('should accept a full GitHubPRData object with files', () => {
      // Arrange & Act
      const pr: GitHubPRData = {
        number: 42,
        title: 'Add scoring engine',
        body: 'Implements the consistency scoring algorithm',
        state: 'open',
        branch: 'feature/scoring',
        baseBranch: 'main',
        files: [
          { filename: 'scoring.ts', status: 'added', additions: 100, deletions: 0 },
          { filename: 'utils.ts', status: 'modified', additions: 10, deletions: 5 },
        ],
        url: 'https://github.com/org/repo/pull/42',
      };

      // Assert
      expect(pr.number).toBe(42);
      expect(pr.title).toBe('Add scoring engine');
      expect(pr.state).toBe('open');
      expect(pr.branch).toBe('feature/scoring');
      expect(pr.baseBranch).toBe('main');
      expect(pr.files).toHaveLength(2);
      expect(pr.files[0]?.filename).toBe('scoring.ts');
      expect(pr.url).toContain('github.com');
    });
  });

  describe('edge cases', () => {
    it('should accept a PR with empty files array', () => {
      // Arrange & Act
      const pr: GitHubPRData = {
        number: 1,
        title: 'Empty PR',
        body: '',
        state: 'open',
        branch: 'feature/empty',
        baseBranch: 'main',
        files: [],
        url: 'https://github.com/org/repo/pull/1',
      };

      // Assert
      expect(pr.files).toHaveLength(0);
    });

    it('should accept empty body', () => {
      // Arrange & Act
      const pr: GitHubPRData = {
        number: 2,
        title: 'No body',
        body: '',
        state: 'closed',
        branch: 'fix/test',
        baseBranch: 'main',
        files: [],
        url: 'https://github.com/org/repo/pull/2',
      };

      // Assert
      expect(pr.body).toBe('');
    });

    it('should accept PR number zero', () => {
      // Arrange & Act
      const pr: GitHubPRData = {
        number: 0,
        title: 'Zero PR',
        body: 'test',
        state: 'merged',
        branch: 'main',
        baseBranch: 'main',
        files: [],
        url: 'https://github.com/org/repo/pull/0',
      };

      // Assert
      expect(pr.number).toBe(0);
    });

    it('should narrow by PR state in a conditional', () => {
      // Arrange
      const pr: GitHubPRData = {
        number: 1,
        title: 'Test',
        body: '',
        state: 'merged',
        branch: 'feature/test',
        baseBranch: 'main',
        files: [],
        url: 'https://github.com/org/repo/pull/1',
      };

      // Act & Assert
      if (pr.state === 'merged') {
        expect(pr.state).toBe('merged');
      }
    });

    it('should allow iterating over readonly files array', () => {
      // Arrange
      const pr: GitHubPRData = {
        number: 3,
        title: 'Multi-file PR',
        body: 'Changes',
        state: 'open',
        branch: 'feature/multi',
        baseBranch: 'main',
        files: [
          { filename: 'a.ts', status: 'added', additions: 10, deletions: 0 },
          { filename: 'b.ts', status: 'modified', additions: 5, deletions: 2 },
          { filename: 'c.ts', status: 'removed', additions: 0, deletions: 8 },
        ],
        url: 'https://github.com/org/repo/pull/3',
      };

      // Act
      const totalAdditions = pr.files.reduce((sum, f) => sum + f.additions, 0);
      const totalDeletions = pr.files.reduce((sum, f) => sum + f.deletions, 0);

      // Assert
      expect(totalAdditions).toBe(15);
      expect(totalDeletions).toBe(10);
    });
  });
});

// ---------------------------------------------------------------------------
// GitHubStatusCheck
// ---------------------------------------------------------------------------

describe('GitHubStatusCheck', () => {
  describe('happy path', () => {
    it('should accept all valid status check states', () => {
      // Arrange
      const states: Array<GitHubStatusCheck['state']> = ['pending', 'success', 'failure', 'error'];

      // Assert
      expect(states).toHaveLength(4);
      expect(states).toContain('pending');
      expect(states).toContain('success');
      expect(states).toContain('failure');
      expect(states).toContain('error');
    });

    it('should accept a valid GitHubStatusCheck', () => {
      // Arrange & Act
      const check: GitHubStatusCheck = {
        state: 'success',
        targetUrl: 'https://jira.example.com/browse/PROJ-100',
        description: 'Quality gate passed with score 0.85',
        context: 'rovo-execution-guard/consistency',
      };

      // Assert
      expect(check.state).toBe('success');
      expect(check.context).toBe('rovo-execution-guard/consistency');
      expect(check.description).toContain('0.85');
      expect(check.targetUrl).toContain('PROJ-100');
    });
  });

  describe('edge cases', () => {
    it('should accept empty targetUrl and description', () => {
      // Arrange & Act
      const check: GitHubStatusCheck = {
        state: 'pending',
        targetUrl: '',
        description: '',
        context: 'test',
      };

      // Assert
      expect(check.targetUrl).toBe('');
      expect(check.description).toBe('');
    });

    it('should accept empty context', () => {
      // Arrange & Act
      const check: GitHubStatusCheck = {
        state: 'error',
        targetUrl: 'https://example.com',
        description: 'Something went wrong',
        context: '',
      };

      // Assert
      expect(check.context).toBe('');
    });

    it('should narrow by state in a conditional', () => {
      // Arrange
      const check: GitHubStatusCheck = {
        state: 'failure',
        targetUrl: 'https://example.com',
        description: 'Failed',
        context: 'ci/test',
      };

      // Act & Assert
      if (check.state === 'failure') {
        expect(check.description).toBe('Failed');
      }
    });

    it('should filter status checks by state', () => {
      // Arrange
      const checks: readonly GitHubStatusCheck[] = [
        { state: 'pending', targetUrl: '', description: '', context: 'a' },
        { state: 'success', targetUrl: '', description: '', context: 'b' },
        { state: 'pending', targetUrl: '', description: '', context: 'c' },
        { state: 'error', targetUrl: '', description: '', context: 'd' },
      ];

      // Act
      const pending = checks.filter((c) => c.state === 'pending');

      // Assert
      expect(pending).toHaveLength(2);
    });
  });
});
