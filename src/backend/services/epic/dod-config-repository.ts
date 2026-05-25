// [ARCH-SOLID-058] DoD Config Repository — Forge Storage persistence for per-epic DoD
// [ARCH-SOLID-006] Handler -> Service -> Repository (this is the Repository)
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only, no default export
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state

import type { EpicDoDConfig, DoDCriterion, DoDCriterionType } from '../../types/epic-types';
import { StorageError } from '../../types/errors';

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

const STORAGE_KEY_PREFIX = 'dod';
const MAX_STORAGE_BYTES = 4_096;

// ═══════════════════════════════════════════
// STRUCTURED LOGGING
// ═══════════════════════════════════════════

interface StructuredLogEntry {
  readonly timestamp: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly operation: string;
  readonly executionId?: string;
  readonly [key: string]: unknown;
}

const log = (
  level: StructuredLogEntry['level'],
  operation: string,
  executionId?: string,
  data?: Record<string, unknown>,
): void => {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ timestamp: new Date().toISOString(), level, operation, executionId, ...data }),
  );
};

// ═══════════════════════════════════════════
// STORAGE KEY HELPER
// ═══════════════════════════════════════════

const buildStorageKey = (projectKey: string, epicKey: string): string =>
  `${STORAGE_KEY_PREFIX}:${projectKey}:${epicKey}`;

// ═══════════════════════════════════════════
// DEFAULT CONFIG FACTORY
// ═══════════════════════════════════════════

const DEFAULT_CRITERIA: readonly DoDCriterion[] = [
  { type: 'all_subtickets_closed' as DoDCriterionType, enabled: true },
  {
    type: 'confluence_page_updated' as DoDCriterionType,
    enabled: true,
    config: { maxAgeDays: 30 },
  },
  { type: 'prs_merged' as DoDCriterionType, enabled: true },
  { type: 'no_open_blockers' as DoDCriterionType, enabled: true },
  { type: 'no_critical_inconsistencies' as DoDCriterionType, enabled: true },
  { type: 'score_above_threshold' as DoDCriterionType, enabled: true, config: { threshold: 80 } },
] as const;

export const getDefaultDoDConfig = (epicKey: string, projectKey: string): EpicDoDConfig => ({
  epicKey,
  projectKey,
  criteria: DEFAULT_CRITERIA.map((c) => ({ ...c })),
  updatedAt: new Date().toISOString(),
});

// ═══════════════════════════════════════════
// READ CONFIG
// ═══════════════════════════════════════════

export const getDoDConfig = async (epicKey: string, projectKey: string): Promise<EpicDoDConfig> => {
  const operation = 'getDoDConfig';

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { storage } = require('@forge/api');
    const key = buildStorageKey(projectKey, epicKey);
    const raw = await storage.get(key);

    if (raw === undefined || raw === null) {
      log('info', operation, undefined, {
        epicKey,
        projectKey,
        note: 'no stored config, returning defaults',
      });
      return getDefaultDoDConfig(epicKey, projectKey);
    }

    const parsed = JSON.parse(String(raw)) as EpicDoDConfig;
    log('info', operation, undefined, {
      epicKey,
      projectKey,
      criteriaCount: parsed.criteria.length,
    });
    return parsed;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error reading DoD config';
    log('warn', operation, undefined, { epicKey, projectKey, error: message });
    return getDefaultDoDConfig(epicKey, projectKey);
  }
};

// ═══════════════════════════════════════════
// WRITE CONFIG
// ═══════════════════════════════════════════

export const saveDoDConfig = async (config: EpicDoDConfig): Promise<void> => {
  const operation = 'saveDoDConfig';
  const { epicKey, projectKey } = config;

  // Validate: at least one criterion
  if (config.criteria.length === 0) {
    throw new StorageError(
      'DoD config must have at least one criterion',
      'DOD_CONFIG_EMPTY',
      undefined,
      buildStorageKey(projectKey, epicKey),
    );
  }

  const serialized = JSON.stringify(config);

  // Validate: fits under Forge Storage limit
  const byteLength = Buffer.byteLength(serialized, 'utf-8');
  if (byteLength > MAX_STORAGE_BYTES) {
    throw new StorageError(
      `DoD config exceeds ${MAX_STORAGE_BYTES} byte limit (${byteLength} bytes)`,
      'DOD_CONFIG_TOO_LARGE',
      undefined,
      buildStorageKey(projectKey, epicKey),
    );
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { storage } = require('@forge/api');
    const key = buildStorageKey(projectKey, epicKey);
    await storage.set(key, serialized);
    log('info', operation, undefined, { epicKey, projectKey, byteLength });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error writing DoD config';
    throw new StorageError(
      message,
      'DOD_CONFIG_WRITE_FAILED',
      undefined,
      buildStorageKey(projectKey, epicKey),
    );
  }
};
