// Test suite for ProjectConfig and GateConfig domain types
// Covers: GateConfig booleans, ProjectConfig with/without optional GitHub fields
// Tests: happy path, edge cases, readonly properties

import type { GateConfig, ProjectConfig } from '../../../src/backend/types/project-config';

// ---------------------------------------------------------------------------
// GateConfig
// ---------------------------------------------------------------------------

describe('GateConfig', () => {
  describe('happy path', () => {
    it('should accept a GateConfig with all gates enabled', () => {
      // Arrange & Act
      const config: GateConfig = {
        definition: true,
        execution: true,
        delivery: true,
      };

      // Assert
      expect(config.definition).toBe(true);
      expect(config.execution).toBe(true);
      expect(config.delivery).toBe(true);
    });

    it('should accept a GateConfig with all gates disabled', () => {
      // Arrange & Act
      const config: GateConfig = {
        definition: false,
        execution: false,
        delivery: false,
      };

      // Assert
      expect(config.definition).toBe(false);
      expect(config.execution).toBe(false);
      expect(config.delivery).toBe(false);
    });

    it('should accept a mixed GateConfig with some gates enabled', () => {
      // Arrange & Act
      const config: GateConfig = {
        definition: true,
        execution: false,
        delivery: true,
      };

      // Assert
      expect(config.definition).toBe(true);
      expect(config.execution).toBe(false);
      expect(config.delivery).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should have exactly three boolean properties', () => {
      // Arrange
      const config: GateConfig = {
        definition: true,
        execution: false,
        delivery: true,
      };

      // Act
      const keys = Object.keys(config);

      // Assert
      expect(keys).toEqual(['definition', 'execution', 'delivery']);
      expect(keys).toHaveLength(3);
    });

    it('should return correct values when iterated', () => {
      // Arrange
      const config: GateConfig = {
        definition: true,
        execution: false,
        delivery: true,
      };

      // Act
      const enabledCount = Object.values(config).filter(Boolean).length;

      // Assert
      expect(enabledCount).toBe(2);
    });
  });
});

// ---------------------------------------------------------------------------
// ProjectConfig
// ---------------------------------------------------------------------------

describe('ProjectConfig', () => {
  describe('happy path – minimal config', () => {
    it('should accept a minimal ProjectConfig without GitHub fields', () => {
      // Arrange & Act
      const config: ProjectConfig = {
        projectKey: 'PROJ',
        enabled: true,
        scoreThreshold: 0.8,
        gates: {
          definition: true,
          execution: false,
          delivery: false,
        },
      };

      // Assert
      expect(config.projectKey).toBe('PROJ');
      expect(config.enabled).toBe(true);
      expect(config.scoreThreshold).toBe(0.8);
      expect(config.gates.definition).toBe(true);
      expect(config.gates.execution).toBe(false);
      expect(config.gates.delivery).toBe(false);
      expect(config.githubRepo).toBeUndefined();
      expect(config.githubOwner).toBeUndefined();
    });
  });

  describe('happy path – full config with GitHub fields', () => {
    it('should accept a full ProjectConfig with GitHub fields', () => {
      // Arrange & Act
      const config: ProjectConfig = {
        projectKey: 'TEAM',
        enabled: true,
        scoreThreshold: 0.85,
        gates: {
          definition: true,
          execution: true,
          delivery: true,
        },
        githubRepo: 'rovo-execution-guard',
        githubOwner: 'my-org',
      };

      // Assert
      expect(config.githubRepo).toBe('rovo-execution-guard');
      expect(config.githubOwner).toBe('my-org');
    });

    it('should accept a config with only githubRepo but not githubOwner', () => {
      // Arrange & Act
      const config: ProjectConfig = {
        projectKey: 'PROJ',
        enabled: true,
        scoreThreshold: 0.7,
        gates: { definition: true, execution: true, delivery: false },
        githubRepo: 'my-repo',
      };

      // Assert
      expect(config.githubRepo).toBe('my-repo');
      expect(config.githubOwner).toBeUndefined();
    });

    it('should accept a config with only githubOwner but not githubRepo', () => {
      // Arrange & Act
      const config: ProjectConfig = {
        projectKey: 'PROJ',
        enabled: true,
        scoreThreshold: 0.7,
        gates: { definition: true, execution: true, delivery: false },
        githubOwner: 'my-org',
      };

      // Assert
      expect(config.githubOwner).toBe('my-org');
      expect(config.githubRepo).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should accept a disabled ProjectConfig', () => {
      // Arrange & Act
      const config: ProjectConfig = {
        projectKey: 'DISABLED',
        enabled: false,
        scoreThreshold: 0.5,
        gates: {
          definition: false,
          execution: false,
          delivery: false,
        },
      };

      // Assert
      expect(config.enabled).toBe(false);
    });

    it('should accept zero scoreThreshold', () => {
      // Arrange & Act
      const config: ProjectConfig = {
        projectKey: 'ZERO',
        enabled: true,
        scoreThreshold: 0,
        gates: { definition: true, execution: true, delivery: true },
      };

      // Assert
      expect(config.scoreThreshold).toBe(0);
    });

    it('should accept scoreThreshold of 1', () => {
      // Arrange & Act
      const config: ProjectConfig = {
        projectKey: 'STRICT',
        enabled: true,
        scoreThreshold: 1,
        gates: { definition: true, execution: true, delivery: true },
      };

      // Assert
      expect(config.scoreThreshold).toBe(1);
    });

    it('should accept empty string projectKey', () => {
      // Arrange & Act
      const config: ProjectConfig = {
        projectKey: '',
        enabled: true,
        scoreThreshold: 0.8,
        gates: { definition: true, execution: true, delivery: true },
      };

      // Assert
      expect(config.projectKey).toBe('');
    });

    it('should accept negative scoreThreshold (no runtime constraint)', () => {
      // Arrange & Act
      const config: ProjectConfig = {
        projectKey: 'NEG',
        enabled: true,
        scoreThreshold: -0.5,
        gates: { definition: false, execution: false, delivery: false },
      };

      // Assert
      expect(config.scoreThreshold).toBe(-0.5);
    });
  });

  describe('nested gates access', () => {
    it('should allow deep property access on nested gates', () => {
      // Arrange
      const config: ProjectConfig = {
        projectKey: 'DEEP',
        enabled: true,
        scoreThreshold: 0.75,
        gates: {
          definition: true,
          execution: false,
          delivery: true,
        },
      };

      // Act
      const { definition, execution, delivery } = config.gates;

      // Assert
      expect(definition).toBe(true);
      expect(execution).toBe(false);
      expect(delivery).toBe(true);
    });
  });
});
