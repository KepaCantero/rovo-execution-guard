// [TEST-QA-204] afterEach cleanup mandatory
// [ARCH-SOLID-202] Zero any — all mocks fully typed
// [TEST-QA-0764] Self-contained, mock all Forge API

import type { EpicDoDConfig, DoDCriterion } from '../../../../src/backend/types/epic-types';

const mockStorageGet = jest.fn<Promise<unknown>, [string]>().mockResolvedValue(undefined);
const mockStorageSet = jest.fn<Promise<void>, [string, unknown]>().mockResolvedValue(undefined);

jest.mock('@forge/api', () => ({
  storage: {
    get: (...args: [string]) => mockStorageGet(...args),
    set: (...args: [string, unknown]) => mockStorageSet(...args),
  },
}));

import {
  getDefaultDoDConfig,
  getDoDConfig,
  saveDoDConfig,
} from '../../../../src/backend/services/epic/dod-config-repository';
import { StorageError } from '../../../../src/backend/types/errors';

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const DEFAULT_TEST_CRITERIA: readonly DoDCriterion[] = [
  { type: 'all_subtickets_closed', enabled: true },
  { type: 'confluence_page_updated', enabled: true, config: { maxAgeDays: 30 } },
  { type: 'prs_merged', enabled: true },
  { type: 'no_open_blockers', enabled: true },
  { type: 'no_critical_inconsistencies', enabled: true },
  { type: 'score_above_threshold', enabled: true, config: { threshold: 80 } },
];

const makeDoDConfig = (overrides: Partial<EpicDoDConfig> = {}): EpicDoDConfig => ({
  epicKey: 'PROJ-100',
  projectKey: 'PROJ',
  criteria: DEFAULT_TEST_CRITERIA,
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// ═══════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════

describe('getDefaultDoDConfig', () => {
  it('returns all 6 criteria enabled', () => {
    const config = getDefaultDoDConfig('PROJ-100', 'PROJ');

    expect(config.epicKey).toBe('PROJ-100');
    expect(config.projectKey).toBe('PROJ');
    expect(config.criteria).toHaveLength(6);
    expect(config.updatedAt).toBeTruthy();

    const enabledTypes = config.criteria.filter((c) => c.enabled).map((c) => c.type);
    expect(enabledTypes).toEqual([
      'all_subtickets_closed',
      'confluence_page_updated',
      'prs_merged',
      'no_open_blockers',
      'no_critical_inconsistencies',
      'score_above_threshold',
    ]);
  });

  it('includes confluence config with maxAgeDays 30', () => {
    const config = getDefaultDoDConfig('PROJ-100', 'PROJ');
    const confluence = config.criteria.find((c) => c.type === 'confluence_page_updated');
    expect(confluence?.config?.maxAgeDays).toBe(30);
  });

  it('includes score config with threshold 80', () => {
    const config = getDefaultDoDConfig('PROJ-100', 'PROJ');
    const score = config.criteria.find((c) => c.type === 'score_above_threshold');
    expect(score?.config?.threshold).toBe(80);
  });
});

describe('getDoDConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns stored config when found in storage', async () => {
    const stored = makeDoDConfig({ epicKey: 'PROJ-200' });
    mockStorageGet.mockResolvedValueOnce(JSON.stringify(stored));

    const result = await getDoDConfig('PROJ-200', 'PROJ');

    expect(result.epicKey).toBe('PROJ-200');
    expect(mockStorageGet).toHaveBeenCalledWith('dod:PROJ:PROJ-200');
  });

  it('returns defaults when storage returns undefined', async () => {
    mockStorageGet.mockResolvedValueOnce(undefined);

    const result = await getDoDConfig('PROJ-300', 'PROJ');

    expect(result.epicKey).toBe('PROJ-300');
    expect(result.criteria).toHaveLength(6);
    expect(mockStorageGet).toHaveBeenCalledWith('dod:PROJ:PROJ-300');
  });

  it('returns defaults when storage returns null', async () => {
    mockStorageGet.mockResolvedValueOnce(null);

    const result = await getDoDConfig('PROJ-400', 'PROJ');

    expect(result.epicKey).toBe('PROJ-400');
    expect(result.criteria).toHaveLength(6);
  });

  it('returns defaults on storage error', async () => {
    mockStorageGet.mockRejectedValueOnce(new Error('storage unavailable'));

    const result = await getDoDConfig('PROJ-500', 'PROJ');

    expect(result.epicKey).toBe('PROJ-500');
    expect(result.criteria).toHaveLength(6);
  });

  it('returns defaults on JSON parse error', async () => {
    mockStorageGet.mockResolvedValueOnce('not-valid-json{{{');

    const result = await getDoDConfig('PROJ-600', 'PROJ');

    expect(result.epicKey).toBe('PROJ-600');
    expect(result.criteria).toHaveLength(6);
  });
});

describe('saveDoDConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes valid config to storage', async () => {
    const config = makeDoDConfig();

    await saveDoDConfig(config);

    expect(mockStorageSet).toHaveBeenCalledWith('dod:PROJ:PROJ-100', expect.any(String));

    const callArgs = mockStorageSet.mock.calls[0];
    expect(callArgs).toBeDefined();
    const serialized = callArgs?.[1];
    expect(typeof serialized).toBe('string');
    const parsed = JSON.parse(serialized as string);
    expect(parsed.epicKey).toBe('PROJ-100');
  });

  it('throws StorageError when config has no criteria', async () => {
    const config = makeDoDConfig({ criteria: [] });

    try {
      await saveDoDConfig(config);
      expect(true).toBe(false); // should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(StorageError);
      expect((error as StorageError).message).toContain('at least one criterion');
    }
    expect(mockStorageSet).not.toHaveBeenCalled();
  });

  it('throws StorageError when storage write fails', async () => {
    const config = makeDoDConfig();
    mockStorageSet.mockRejectedValue(new Error('write failed'));

    try {
      await saveDoDConfig(config);
      expect(true).toBe(false); // should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(StorageError);
      expect((error as StorageError).message).toContain('write failed');
    }
  });
});
