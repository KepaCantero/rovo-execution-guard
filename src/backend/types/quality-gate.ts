// [ARCH-SOLID-058] Quality gate domain model — zero framework dependencies
// [ARCH-SOLID-203] Interface for public data structure
// [ARCH-SOLID-061] Bounded context: Ticket Validation / PR Enforcement

import type { ConsistencyScore } from './consistency-score';
import type { Inconsistency } from './inconsistency';

export type GateType = 'definition' | 'execution' | 'delivery';

export interface QualityGateResult {
  readonly gate: GateType;
  readonly passed: boolean;
  readonly score: ConsistencyScore;
  readonly inconsistencies: readonly Inconsistency[];
  readonly blockedTransitions: readonly string[];
  readonly executionId: string;
}
