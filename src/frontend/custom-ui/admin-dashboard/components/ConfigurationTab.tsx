// [ARCH-SOLID-004] Presentational component — all data via props, no business logic
// [ARCH-SOLID-232] Named export only — no default export
// [ARCH-SOLID-205] Explicit return type on exported component
// [UI-ADS-202] Presentational: data via props from parent container using useProjectConfig hook
// [UI-ADS-001] All colors via @atlaskit/tokens design tokens
// [SEC-PRIV-004] Component-level UX validation for inline error feedback

import { useState, useMemo } from 'react';
import { token } from '@atlaskit/tokens';
import SectionMessage from '@atlaskit/section-message';
import Button from '@atlaskit/button';
import Spinner from '@atlaskit/spinner';
import Textfield from '@atlaskit/textfield';
import Toggle from '@atlaskit/toggle';
import Range from '@atlaskit/range';

import type { ConfigurationTabProps } from '../types';
import type { ProjectConfig, GateConfig } from '../../../../backend/types/project-config';

// ═══════════════════════════════════════════
// CONSTANTS
// [ARCH-SOLID-231] UPPER_SNAKE_CASE for constants
// ═══════════════════════════════════════════

const THRESHOLD_MIN = 0;
const THRESHOLD_MAX = 100;

// ═══════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════

/** Returns the string value or empty string if undefined */
function coalesce(value: string | undefined): string {
  return value !== undefined ? value : '';
}

/**
 * Validates GitHub repo URL format for UX-level inline feedback.
 * [SEC-PRIV-004] — component-level validation, NOT duplicating hook's validateConfig()
 */
function validateGithubUrl(value: string): string | null {
  if (value.length === 0) return null;
  if (!value.startsWith('https://')) {
    return 'GitHub repository URL must start with https://';
  }
  return null;
}

/**
 * Builds a ProjectConfig from current form state.
 * Pure function — no side effects.
 */
function buildConfig(
  projectKey: string,
  enabled: boolean,
  scoreThreshold: number,
  gates: GateConfig,
  githubRepo: string,
  githubOwner: string,
): ProjectConfig {
  return {
    projectKey,
    enabled,
    scoreThreshold,
    gates,
    githubRepo: githubRepo.length > 0 ? githubRepo : undefined,
    githubOwner: githubOwner.length > 0 ? githubOwner : undefined,
  };
}

/**
 * Creates the save handler with validation guard.
 * Extracted to reduce main component complexity.
 */
function createSaveHandler(
  hasValidationErrors: boolean,
  config: ProjectConfig | null,
  enabled: boolean,
  scoreThreshold: number,
  gates: GateConfig,
  githubRepo: string,
  githubOwner: string,
  onSave: (config: ProjectConfig) => void,
): () => void {
  return () => {
    if (hasValidationErrors || !config) return;
    onSave(buildConfig(config.projectKey, enabled, scoreThreshold, gates, githubRepo, githubOwner));
  };
}

// ═══════════════════════════════════════════
// SUB-COMPONENTS (reduce main function complexity)
// ═══════════════════════════════════════════

interface GateToggleRowProps {
  readonly gateKey: string;
  readonly label: string;
  readonly isChecked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly isLast: boolean;
}

/** Single gate toggle row [AC-07] */
function GateToggleRow({
  gateKey,
  label,
  isChecked,
  onChange,
  isLast,
}: GateToggleRowProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: isLast ? '0' : '12px',
      }}
    >
      <label htmlFor={`config-gate-${gateKey}`}>{label}</label>
      <Toggle
        id={`config-gate-${gateKey}`}
        isChecked={isChecked}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
        aria-label={`Toggle ${gateKey} gate`}
        testId={`config-gate-${gateKey}`}
      />
    </div>
  );
}

// ═══════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════

/**
 * ConfigurationTab — editable form for ProjectConfig.
 *
 * Displays loading, error, and empty states. Renders form fields for
 * enabled toggle, score threshold slider, gate toggles, GitHub repo/owner
 * inputs, and a save button. Component-level validation provides immediate
 * inline error messages for UX. The hook's validateConfig() is the security
 * boundary.
 *
 * AC ref: AC-03, AC-06, AC-07 of RTASK-019
 * REGLA: UI-ADS-202 - presentational, data via props
 * REGLA: ARCH-SOLID-004 - no business logic
 */
export function ConfigurationTab(props: ConfigurationTabProps): React.ReactElement {
  const { config, loading, error, saving, onSave } = props;

  // ─── Form state [UI-ADS-201] Hooks at top level ───
  const [enabled, setEnabled] = useState<boolean>(false);
  const [scoreThreshold, setScoreThreshold] = useState<number>(75);
  const [gates, setGates] = useState<GateConfig>({
    definition: true,
    execution: true,
    delivery: true,
  });
  const [githubRepo, setGithubRepo] = useState<string>('');
  const [githubOwner, setGithubOwner] = useState<string>('');
  const [initialized, setInitialized] = useState<boolean>(false);

  // ─── Initialize form from config prop ───
  // [UI-ADS-201] useState + conditional update on first render
  if (config !== null && !initialized) {
    setEnabled(config.enabled);
    setScoreThreshold(config.scoreThreshold);
    setGates({ ...config.gates });
    setGithubRepo(coalesce(config.githubRepo));
    setGithubOwner(coalesce(config.githubOwner));
    setInitialized(true);
  }

  // ─── Derived values [UI-ADS-205] useMemo ───
  const githubRepoError = useMemo(() => validateGithubUrl(githubRepo), [githubRepo]);

  const hasValidationErrors = useMemo(() => githubRepoError !== null, [githubRepoError]);

  // ─── Handlers ───
  function handleGateChange(gateKey: keyof GateConfig, isChecked: boolean): void {
    setGates((prev) => ({ ...prev, [gateKey]: isChecked }));
  }

  const handleSave = createSaveHandler(
    hasValidationErrors,
    config,
    enabled,
    scoreThreshold,
    gates,
    githubRepo,
    githubOwner,
    onSave,
  );

  // ─── Loading state [AC-01] ───
  if (loading) {
    return <Spinner testId="config-loading" />;
  }

  // ─── Error state [AC-02] [SEC-PRIV-0792] ───
  if (error !== null) {
    return (
      <SectionMessage appearance="error" testId="config-error">
        <p>{error}</p>
      </SectionMessage>
    );
  }

  // ─── Empty state [AC-03] ───
  if (config === null) {
    return <p data-testid="config-empty">No configuration data available.</p>;
  }

  // ─── Configuration form [AC-04] ───
  return (
    <section
      data-testid="config-form"
      aria-label="Project configuration form"
      style={{ maxWidth: '600px' }}
    >
      {/* Enabled toggle [AC-05] */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px',
        }}
      >
        <label htmlFor="config-enabled-toggle" style={{ fontWeight: 600 }}>
          Enabled
        </label>
        <Toggle
          id="config-enabled-toggle"
          isChecked={enabled}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnabled(e.target.checked)}
          aria-label="Toggle enforcement enabled"
          testId="config-enabled-toggle"
        />
      </div>

      {/* Score Threshold slider [AC-06] */}
      <div style={{ marginBottom: '20px' }}>
        <label
          htmlFor="config-threshold-slider"
          style={{
            display: 'block',
            fontWeight: 600,
            marginBottom: '8px',
            color: token('color.text'),
          }}
        >
          Score Threshold: {scoreThreshold}
        </label>
        <Range
          id="config-threshold-slider"
          min={THRESHOLD_MIN}
          max={THRESHOLD_MAX}
          step={1}
          value={scoreThreshold}
          onChange={(value: number) => setScoreThreshold(value)}
          aria-label={`Score threshold: ${scoreThreshold}`}
          testId="config-threshold-slider"
        />
      </div>

      {/* Gate toggles [AC-07] */}
      <fieldset
        style={{
          border: `1px solid ${token('color.border')}`,
          borderRadius: '4px',
          padding: '16px',
          marginBottom: '20px',
        }}
      >
        <legend
          style={{
            fontWeight: 600,
            padding: '0 8px',
            color: token('color.text'),
          }}
        >
          Quality Gates
        </legend>

        <GateToggleRow
          gateKey="definition"
          label="Definition"
          isChecked={gates.definition}
          onChange={(checked) => handleGateChange('definition', checked)}
          isLast={false}
        />
        <GateToggleRow
          gateKey="execution"
          label="Execution"
          isChecked={gates.execution}
          onChange={(checked) => handleGateChange('execution', checked)}
          isLast={false}
        />
        <GateToggleRow
          gateKey="delivery"
          label="Delivery"
          isChecked={gates.delivery}
          onChange={(checked) => handleGateChange('delivery', checked)}
          isLast={true}
        />
      </fieldset>

      {/* GitHub integration fields [AC-08] */}
      <div style={{ marginBottom: '20px' }}>
        <label
          htmlFor="config-github-repo"
          style={{
            display: 'block',
            fontWeight: 600,
            marginBottom: '4px',
            color: token('color.text'),
          }}
        >
          GitHub Repository URL
        </label>
        <Textfield
          id="config-github-repo"
          value={githubRepo}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGithubRepo(e.target.value)}
          aria-label="GitHub repository URL"
          placeholder="https://github.com/owner/repo"
          testId="config-github-repo"
        />
        {/* Inline validation [AC-11] [SEC-PRIV-004] */}
        {githubRepoError !== null && (
          <p
            data-testid="config-github-repo-error"
            style={{
              color: token('color.text.danger'),
              fontSize: '12px',
              marginTop: '4px',
            }}
          >
            {githubRepoError}
          </p>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label
          htmlFor="config-github-owner"
          style={{
            display: 'block',
            fontWeight: 600,
            marginBottom: '4px',
            color: token('color.text'),
          }}
        >
          GitHub Owner
        </label>
        <Textfield
          id="config-github-owner"
          value={githubOwner}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGithubOwner(e.target.value)}
          aria-label="GitHub owner"
          placeholder="owner or organization"
          testId="config-github-owner"
        />
      </div>

      {/* Save button [AC-09] [AC-10] [AC-12] */}
      <Button
        appearance="primary"
        onClick={handleSave}
        isDisabled={saving || hasValidationErrors}
        aria-label="Save configuration"
        testId="config-save-button"
      >
        {saving ? 'Saving...' : 'Save Configuration'}
      </Button>
    </section>
  );
}
