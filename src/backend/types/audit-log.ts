// [ARCH-SOLID-058] Audit log domain model — zero framework dependencies
// [ARCH-SOLID-203] Interface for public data structure

export type AuditAction =
  | 'gate_evaluated'
  | 'ticket_blocked'
  | 'ticket_approved'
  | 'pr_blocked'
  | 'pr_approved'
  | 'config_updated'
  | 'inconsistency_flagged'
  | 'enforcement_executed';

export interface AuditLogEntry {
  readonly id: string;
  readonly action: AuditAction;
  readonly timestamp: string;
  readonly executionId: string;
  readonly projectKey: string;
  readonly ticketKey?: string;
  readonly prNumber?: number;
  readonly userId?: string;
  readonly details: Record<string, unknown>;
}
