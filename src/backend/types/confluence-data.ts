// [ARCH-SOLID-058] Confluence data domain model — zero framework dependencies
// [ARCH-SOLID-203] Interface for public data structure

export interface ConfluencePageData {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly spaceKey: string;
  readonly url: string;
  readonly lastUpdated: string;
}

export interface ConfluencePageMetadata {
  readonly id: string;
  readonly title: string;
  readonly spaceKey: string;
  readonly labels: readonly string[];
  readonly version: number;
  readonly lastUpdated: string;
}
