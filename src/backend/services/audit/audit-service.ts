// [ARCH-SOLID-058] SERVICE layer — audit log persistence via Forge Storage
// [ARCH-SOLID-006] Handler -> Service -> Repository pattern
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-053] Domain-specific error types
// [ARCH-SOLID-232] Named exports only, no export default
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state
// [SEC-PRIV-010] Audit log: who, what, when, resource
// [SEC-PRIV-008] Data minimization — only metadata

import type { AuditLogEntry } from '../../types/audit-log';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** [ARCH-SOLID-203] Query parameters for reading audit log */
interface AuditLogQuery {
  readonly projectKey: string;
  readonly limit?: number;
  readonly offset?: number;
}

/** [ARCH-SOLID-203] Storage key prefix for audit entries */
type AuditStorageKey = `audit:${string}`;

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

/** Maximum entries to store per project before rotation */
const MAX_ENTRIES_PER_PROJECT = 500;

/** Maximum entries to return per query */
const MAX_QUERY_LIMIT = 100;

// ═══════════════════════════════════════════
// STORAGE HELPERS
// ═══════════════════════════════════════════

/**
 * Builds the Forge Storage key for a project's audit log index.
 * [ARCH-SOLID-052] Extracted helper.
 */
const indexKey = (projectKey: string): AuditStorageKey => `audit:${projectKey}:index`;

/**
 * Gets the Forge Storage API.
 * Dynamic import to avoid bundling issues in test environments.
 */
const getStorage = (): {
  readonly get: (key: string) => Promise<unknown>;
  readonly set: (key: string, value: unknown) => Promise<void>;
  readonly delete: (key: string) => Promise<void>;
} => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const forgeApi = require('@forge/api') as {
    storage: {
      get: (key: string) => Promise<unknown>;
      set: (key: string, value: unknown) => Promise<void>;
      delete: (key: string) => Promise<void>;
    };
  };
  return forgeApi.storage;
};

// ═══════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════

/**
 * Writes an audit log entry to Forge Storage.
 * [SEC-PRIV-010] Audit log: who, what, when, resource.
 * [FORGE-OPS-054] Graceful degradation — errors logged, not thrown.
 *
 * @param entry - The audit log entry to persist
 */
export const writeAuditEntry = async (entry: AuditLogEntry): Promise<void> => {
  try {
    const storage = getStorage();
    const key = indexKey(entry.projectKey);

    const existing = (await storage.get(key)) as AuditLogEntry[] | undefined;
    const entries = existing ?? [];

    // Prepend new entry (newest first)
    entries.unshift(entry);

    // Rotate: keep only MAX_ENTRIES_PER_PROJECT
    const rotated = entries.slice(0, MAX_ENTRIES_PER_PROJECT);

    await storage.set(key, rotated);
  } catch (storageError: unknown) {
    // [FORGE-OPS-054] Graceful degradation — audit failure should not break the pipeline
    const msg = storageError instanceof Error ? storageError.message : 'Unknown storage error';
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        operation: 'audit-service.writeAuditEntry.failed',
        auditId: entry.id,
        error: msg,
      }),
    );
  }
};

/**
 * Reads audit log entries from Forge Storage.
 * [SEC-PRIV-008] Data minimization — returns only requested fields.
 * [SEC-PRIV-010] Audit log query interface.
 *
 * @param query - Query parameters (projectKey required, limit/offset optional)
 * @returns Array of audit log entries, newest first
 */
export const readAuditEntries = async (query: AuditLogQuery): Promise<readonly AuditLogEntry[]> => {
  const storage = getStorage();
  const key = indexKey(query.projectKey);

  const entries = (await storage.get(key)) as AuditLogEntry[] | undefined;

  if (!entries || !Array.isArray(entries)) {
    return [];
  }

  const limit = Math.min(query.limit ?? MAX_QUERY_LIMIT, MAX_QUERY_LIMIT);
  const offset = query.offset ?? 0;

  return entries.slice(offset, offset + limit);
};
