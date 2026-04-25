// [ARCH-SOLID-058] Consistency score domain model — zero framework dependencies
// [ARCH-SOLID-203] Interface for public data structure

export interface ScoreAxes {
  readonly clarity: number;
  readonly consistency: number;
  readonly risk: number;
  readonly documentation: number;
  readonly technicalDebt: number;
}

export interface ConsistencyScore {
  readonly overall: number;
  readonly axes: ScoreAxes;
  readonly timestamp: string;
  readonly executionId: string;
}
