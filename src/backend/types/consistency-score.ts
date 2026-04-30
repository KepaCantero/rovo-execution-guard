// [ARCH-SOLID-058] Consistency score domain model — zero framework dependencies
// [ARCH-SOLID-203] Interface for public data structure

export interface ScoreAxes {
  readonly clarity: number;
  readonly consistency: number;
  readonly risk: number;
  readonly documentation: number;
  readonly technicalDebt: number;
}

/** Per-axis detail with actionable suggestions derived from scoring signals */
export interface AxisDetail {
  readonly score: number;
  readonly label: string;
  readonly suggestions: readonly string[];
}

/** Ticket context passed to the frontend for Rovo AI prompts */
export interface TicketContext {
  readonly issueKey: string;
  readonly summary: string;
  readonly description: string;
  readonly projectKey: string;
  readonly scoreThreshold: number;
  readonly gates: {
    readonly definition: boolean;
    readonly execution: boolean;
    readonly delivery: boolean;
  };
}

export interface ConsistencyScore {
  readonly overall: number;
  readonly axes: ScoreAxes;
  readonly axisDetails?: Record<string, AxisDetail>;
  readonly ticketContext?: TicketContext;
  readonly timestamp: string;
  readonly executionId: string;
}
