// [ARCH-SOLID-058] Project configuration domain model — zero framework dependencies
// [ARCH-SOLID-203] Interface for public data structure

export interface GateConfig {
  readonly definition: boolean;
  readonly execution: boolean;
  readonly delivery: boolean;
}

export interface ProjectConfig {
  readonly projectKey: string;
  readonly enabled: boolean;
  readonly scoreThreshold: number;
  readonly gates: GateConfig;
  readonly githubRepo?: string;
  readonly githubOwner?: string;
}
