// [ARCH-SOLID-058] Rovo context domain model — zero framework dependencies
// [ARCH-SOLID-203] Interface for public data structure

export interface RovoDocument {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly source: string;
  readonly relevance: number;
}

export interface HistoricalDecision {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly date: string;
  readonly source: string;
}

export interface RovoContext {
  readonly documents: readonly RovoDocument[];
  readonly relatedTickets: readonly string[];
  readonly decisions: readonly HistoricalDecision[];
  readonly query: string;
  readonly timestamp: string;
}
