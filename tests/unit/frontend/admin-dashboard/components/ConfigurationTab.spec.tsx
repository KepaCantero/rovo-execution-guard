/**
 * @jest-environment jsdom
 */

/**
 * Tests for admin-dashboard/components/ConfigurationTab.tsx
 *
 * Verifies the presentational ConfigurationTab component renders loading,
 * error, empty, and form states correctly with all form fields, validation,
 * and save action.
 *
 * Pattern: AAA (Arrange-Act-Assert)
 * No @forge/bridge mock needed — presentational component receives data via props.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { ConfigurationTab } from '../../../../../src/frontend/custom-ui/admin-dashboard/components/ConfigurationTab';
import type { ConfigurationTabProps } from '../../../../../src/frontend/custom-ui/admin-dashboard/types';
import type { ProjectConfig } from '../../../../../src/backend/types/project-config';

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const SAMPLE_CONFIG: ProjectConfig = {
  projectKey: 'PRJ',
  enabled: true,
  scoreThreshold: 75,
  gates: {
    definition: true,
    execution: false,
    delivery: true,
  },
  githubRepo: 'https://github.com/acme/app',
  githubOwner: 'acme',
};

const MINIMAL_CONFIG: ProjectConfig = {
  projectKey: 'PRJ',
  enabled: false,
  scoreThreshold: 50,
  gates: {
    definition: false,
    execution: false,
    delivery: false,
  },
};

const defaultProps: ConfigurationTabProps = {
  config: null,
  loading: false,
  error: null,
  saving: false,
  onSave: jest.fn(),
};

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('ConfigurationTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Loading State ──────────────────

  describe('loading state', () => {
    it('should render spinner when loading is true (AC-01)', () => {
      // Arrange
      const props = { ...defaultProps, loading: true };

      // Act
      render(<ConfigurationTab {...props} />);

      // Assert
      expect(screen.getByTestId('config-loading')).toBeInTheDocument();
    });

    it('should not render form when loading is true', () => {
      // Arrange
      const props = { ...defaultProps, loading: true, config: SAMPLE_CONFIG };

      // Act
      render(<ConfigurationTab {...props} />);

      // Assert
      expect(screen.queryByTestId('config-form')).not.toBeInTheDocument();
    });
  });

  // ─── Error State ────────────────────

  describe('error state', () => {
    it('should render error banner when error is non-null and loading is false (AC-02)', () => {
      // Arrange
      const props = { ...defaultProps, error: 'Failed to load config' };

      // Act
      render(<ConfigurationTab {...props} />);

      // Assert
      expect(screen.getByTestId('config-error')).toBeInTheDocument();
      expect(screen.getByText('Failed to load config')).toBeInTheDocument();
    });

    it('should not render form when error is present', () => {
      // Arrange
      const props = { ...defaultProps, error: 'Network error', config: SAMPLE_CONFIG };

      // Act
      render(<ConfigurationTab {...props} />);

      // Assert
      expect(screen.queryByTestId('config-form')).not.toBeInTheDocument();
    });
  });

  // ─── Empty State ────────────────────

  describe('empty state', () => {
    it('should render empty message when config is null and no error (AC-03)', () => {
      // Arrange
      const props = { ...defaultProps, config: null };

      // Act
      render(<ConfigurationTab {...props} />);

      // Assert
      expect(screen.getByTestId('config-empty')).toBeInTheDocument();
      expect(screen.getByText('No configuration data available.')).toBeInTheDocument();
    });
  });

  // ─── Form Rendering ─────────────────

  describe('form rendering', () => {
    it('should render all form fields with initial config values (AC-04)', () => {
      // Arrange
      const props = { ...defaultProps, config: SAMPLE_CONFIG };

      // Act
      render(<ConfigurationTab {...props} />);

      // Assert — form section rendered
      expect(screen.getByTestId('config-form')).toBeInTheDocument();

      // Enabled toggle should be checked
      const enabledToggle = screen
        .getByTestId('config-enabled-toggle')
        .querySelector('input') as HTMLInputElement;
      expect(enabledToggle.checked).toBe(true);

      // Threshold label should show value
      expect(screen.getByText('Score Threshold: 75')).toBeInTheDocument();

      // Gate toggles — definition checked, execution unchecked, delivery checked
      const defToggle = screen
        .getByTestId('config-gate-definition')
        .querySelector('input') as HTMLInputElement;
      expect(defToggle.checked).toBe(true);

      const execToggle = screen
        .getByTestId('config-gate-execution')
        .querySelector('input') as HTMLInputElement;
      expect(execToggle.checked).toBe(false);

      const delToggle = screen
        .getByTestId('config-gate-delivery')
        .querySelector('input') as HTMLInputElement;
      expect(delToggle.checked).toBe(true);
    });

    it('should render GitHub repo text field with initial value (AC-08)', () => {
      // Arrange
      const props = { ...defaultProps, config: SAMPLE_CONFIG };

      // Act
      render(<ConfigurationTab {...props} />);

      // Assert — @atlaskit/textfield testId returns the <input> directly
      const repoInput = screen.getByTestId('config-github-repo') as HTMLInputElement;
      expect(repoInput.value).toBe('https://github.com/acme/app');
    });

    it('should render GitHub owner text field with initial value (AC-08)', () => {
      // Arrange
      const props = { ...defaultProps, config: SAMPLE_CONFIG };

      // Act
      render(<ConfigurationTab {...props} />);

      // Assert
      const ownerInput = screen.getByTestId('config-github-owner') as HTMLInputElement;
      expect(ownerInput.value).toBe('acme');
    });

    it('should render empty text fields when config has no GitHub fields', () => {
      // Arrange
      const props = { ...defaultProps, config: MINIMAL_CONFIG };

      // Act
      render(<ConfigurationTab {...props} />);

      // Assert
      const repoInput = screen.getByTestId('config-github-repo') as HTMLInputElement;
      expect(repoInput.value).toBe('');

      const ownerInput = screen.getByTestId('config-github-owner') as HTMLInputElement;
      expect(ownerInput.value).toBe('');
    });

    it('should render form section with aria-label (UI-ADS-004)', () => {
      // Arrange
      const props = { ...defaultProps, config: SAMPLE_CONFIG };

      // Act
      render(<ConfigurationTab {...props} />);

      // Assert
      expect(screen.getByTestId('config-form')).toHaveAttribute(
        'aria-label',
        'Project configuration form',
      );
    });
  });

  // ─── Enabled Toggle ─────────────────

  describe('enabled toggle', () => {
    it('should update local form state when toggled (AC-05)', async () => {
      // Arrange
      const props = { ...defaultProps, config: SAMPLE_CONFIG };
      const user = userEvent.setup();

      // Act
      render(<ConfigurationTab {...props} />);
      const toggleInput = screen
        .getByTestId('config-enabled-toggle')
        .querySelector('input') as HTMLInputElement;
      expect(toggleInput.checked).toBe(true);
      await user.click(toggleInput);

      // Assert — toggle state changed
      expect(toggleInput.checked).toBe(false);
    });

    it('should have accessible label for enabled toggle (AC-13)', () => {
      // Arrange
      const props = { ...defaultProps, config: SAMPLE_CONFIG };

      // Act
      render(<ConfigurationTab {...props} />);

      // Assert — accessibility via <label htmlFor> association
      expect(screen.getByText('Enabled')).toBeInTheDocument();
      const toggleWrapper = screen.getByTestId('config-enabled-toggle');
      const input = toggleWrapper.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();
    });
  });

  // ─── Gate Toggles ───────────────────

  describe('gate toggles', () => {
    it('should update gate state when toggled (AC-07)', async () => {
      // Arrange
      const props = { ...defaultProps, config: SAMPLE_CONFIG };
      const user = userEvent.setup();

      // Act
      render(<ConfigurationTab {...props} />);
      const gateInput = screen
        .getByTestId('config-gate-execution')
        .querySelector('input') as HTMLInputElement;
      expect(gateInput.checked).toBe(false);
      await user.click(gateInput);

      // Assert — gate state changed
      expect(gateInput.checked).toBe(true);
    });

    it('should have accessible labels for all gate toggles (AC-13)', () => {
      // Arrange
      const props = { ...defaultProps, config: SAMPLE_CONFIG };

      // Act
      render(<ConfigurationTab {...props} />);

      // Assert — accessibility via visible label text for each gate
      expect(screen.getByText('Definition')).toBeInTheDocument();
      expect(screen.getByText('Execution')).toBeInTheDocument();
      expect(screen.getByText('Delivery')).toBeInTheDocument();

      // Each gate toggle has an underlying input element
      expect(screen.getByTestId('config-gate-definition').querySelector('input')).toBeTruthy();
      expect(screen.getByTestId('config-gate-execution').querySelector('input')).toBeTruthy();
      expect(screen.getByTestId('config-gate-delivery').querySelector('input')).toBeTruthy();
    });
  });

  // ─── Text Field Changes ─────────────

  describe('text field changes', () => {
    it('should update GitHub repo value when typed (AC-08)', async () => {
      // Arrange
      const props = { ...defaultProps, config: MINIMAL_CONFIG };
      const user = userEvent.setup();

      // Act
      render(<ConfigurationTab {...props} />);
      const repoInput = screen.getByTestId('config-github-repo') as HTMLInputElement;
      await user.type(repoInput, 'https://github.com/test/repo');

      // Assert
      expect(repoInput.value).toBe('https://github.com/test/repo');
    });

    it('should update GitHub owner value when typed (AC-08)', async () => {
      // Arrange
      const props = { ...defaultProps, config: MINIMAL_CONFIG };
      const user = userEvent.setup();

      // Act
      render(<ConfigurationTab {...props} />);
      const ownerInput = screen.getByTestId('config-github-owner') as HTMLInputElement;
      await user.type(ownerInput, 'my-org');

      // Assert
      expect(ownerInput.value).toBe('my-org');
    });
  });

  // ─── Save Action ────────────────────

  describe('save action', () => {
    it('should call onSave with updated config when save button clicked (AC-09)', async () => {
      // Arrange
      const onSave = jest.fn();
      const props = { ...defaultProps, config: SAMPLE_CONFIG, onSave };
      const user = userEvent.setup();

      // Act
      render(<ConfigurationTab {...props} />);
      await user.click(screen.getByTestId('config-save-button'));

      // Assert
      expect(onSave).toHaveBeenCalledTimes(1);
      const savedConfig = onSave.mock.calls[0][0] as ProjectConfig;
      expect(savedConfig.projectKey).toBe('PRJ');
      expect(savedConfig.enabled).toBe(true);
      expect(savedConfig.scoreThreshold).toBe(75);
      expect(savedConfig.gates).toEqual({
        definition: true,
        execution: false,
        delivery: true,
      });
      expect(savedConfig.githubRepo).toBe('https://github.com/acme/app');
      expect(savedConfig.githubOwner).toBe('acme');
    });

    it('should pass undefined for empty GitHub fields in saved config', async () => {
      // Arrange
      const onSave = jest.fn();
      const props = { ...defaultProps, config: MINIMAL_CONFIG, onSave };
      const user = userEvent.setup();

      // Act
      render(<ConfigurationTab {...props} />);
      await user.click(screen.getByTestId('config-save-button'));

      // Assert
      expect(onSave).toHaveBeenCalledTimes(1);
      const savedConfig = onSave.mock.calls[0][0] as ProjectConfig;
      expect(savedConfig.githubRepo).toBeUndefined();
      expect(savedConfig.githubOwner).toBeUndefined();
    });

    it('should show Saving... text on save button while saving (AC-10)', () => {
      // Arrange
      const props = { ...defaultProps, config: SAMPLE_CONFIG, saving: true };

      // Act
      render(<ConfigurationTab {...props} />);

      // Assert
      expect(screen.getByTestId('config-save-button')).toHaveTextContent('Saving...');
    });

    it('should disable save button while saving is true (AC-10)', () => {
      // Arrange
      const props = { ...defaultProps, config: SAMPLE_CONFIG, saving: true };

      // Act
      render(<ConfigurationTab {...props} />);

      // Assert
      const button = screen.getByTestId('config-save-button');
      expect(button).toBeDisabled();
    });

    it('should have aria-label on save button (AC-13)', () => {
      // Arrange
      const props = { ...defaultProps, config: SAMPLE_CONFIG };

      // Act
      render(<ConfigurationTab {...props} />);

      // Assert
      expect(screen.getByTestId('config-save-button')).toHaveAttribute(
        'aria-label',
        'Save configuration',
      );
    });
  });

  // ─── Validation [SEC-PRIV-004] ──────

  describe('inline validation', () => {
    it('should show error when GitHub repo does not start with https:// (AC-11)', async () => {
      // Arrange
      const props = { ...defaultProps, config: MINIMAL_CONFIG };
      const user = userEvent.setup();

      // Act
      render(<ConfigurationTab {...props} />);
      const repoInput = screen.getByTestId('config-github-repo') as HTMLInputElement;
      await user.type(repoInput, 'http://github.com/repo');

      // Assert
      expect(screen.getByTestId('config-github-repo-error')).toBeInTheDocument();
      expect(screen.getByTestId('config-github-repo-error')).toHaveTextContent(
        'GitHub repository URL must start with https://',
      );
    });

    it('should not show error when GitHub repo starts with https://', async () => {
      // Arrange
      const props = { ...defaultProps, config: MINIMAL_CONFIG };
      const user = userEvent.setup();

      // Act
      render(<ConfigurationTab {...props} />);
      const repoInput = screen.getByTestId('config-github-repo') as HTMLInputElement;
      await user.type(repoInput, 'https://github.com/valid/repo');

      // Assert
      expect(screen.queryByTestId('config-github-repo-error')).not.toBeInTheDocument();
    });

    it('should not show error when GitHub repo is empty', () => {
      // Arrange
      const props = { ...defaultProps, config: MINIMAL_CONFIG };

      // Act
      render(<ConfigurationTab {...props} />);

      // Assert
      expect(screen.queryByTestId('config-github-repo-error')).not.toBeInTheDocument();
    });

    it('should disable save button when validation errors exist (AC-12)', async () => {
      // Arrange
      const props = { ...defaultProps, config: MINIMAL_CONFIG };
      const user = userEvent.setup();

      // Act
      render(<ConfigurationTab {...props} />);
      const repoInput = screen.getByTestId('config-github-repo') as HTMLInputElement;
      await user.type(repoInput, 'invalid-url');

      // Assert
      const saveButton = screen.getByTestId('config-save-button');
      expect(saveButton).toBeDisabled();
    });

    it('should enable save button when validation errors are resolved', async () => {
      // Arrange
      const onSave = jest.fn();
      const props = { ...defaultProps, config: MINIMAL_CONFIG, onSave };
      const user = userEvent.setup();

      // Act
      render(<ConfigurationTab {...props} />);
      const repoInput = screen.getByTestId('config-github-repo') as HTMLInputElement;

      // Type invalid URL — button disabled
      await user.type(repoInput, 'bad-url');
      expect(screen.getByTestId('config-save-button')).toBeDisabled();

      // Clear and type valid URL — button enabled
      await user.clear(repoInput);
      await user.type(repoInput, 'https://github.com/good/repo');
      expect(screen.queryByTestId('config-github-repo-error')).not.toBeInTheDocument();
      expect(screen.getByTestId('config-save-button')).not.toBeDisabled();
    });
  });

  // ─── Rule Verification ──────────────

  describe('rule compliance', () => {
    it('should use named export — component imported by name (ARCH-SOLID-232)', () => {
      // Arrange & Act — ConfigurationTab is imported as a named import at top of file

      // Assert
      expect(typeof ConfigurationTab).toBe('function');
    });

    it('should not render any script tags — presentational only (UI-ADS-202)', () => {
      // Arrange
      const props = { ...defaultProps, config: SAMPLE_CONFIG };

      // Act
      const { container } = render(<ConfigurationTab {...props} />);

      // Assert
      expect(container.querySelector('script')).not.toBeInTheDocument();
    });

    it('should not call onSave on mount — only on user action (ARCH-SOLID-004)', () => {
      // Arrange
      const onSave = jest.fn();
      const props = { ...defaultProps, config: SAMPLE_CONFIG, onSave };

      // Act
      render(<ConfigurationTab {...props} />);

      // Assert
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});
