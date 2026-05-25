// [ARCH-SOLID-058] Barrel file for epic management services
// [ARCH-SOLID-232] Named exports only, no default export

// --- Cross-Epic Consistency ---
export {
  validateCrossEpicConsistency,
  detectDuplicateCriteria,
  detectConflictingScope,
  detectCoverageHoles,
  detectDependencyGaps,
  calculateCrossEpicConsistencyScore,
} from './cross-epic-validator';

// --- DoD Enforcement ---
export {
  evaluateEpicDoD,
  evaluateAllSubticketsClosed,
  evaluateConfluencePageUpdated,
  evaluatePRsMerged,
  evaluateNoOpenBlockers,
  evaluateNoCriticalInconsistencies,
  evaluateScoreAboveThreshold,
  determineDoDEnforcementActions,
} from './dod-enforcement';

export { getDefaultDoDConfig, getDoDConfig, saveDoDConfig } from './dod-config-repository';

// --- Dependency Chain ---
export {
  validateDependencyChain,
  buildDependencyGraph,
  detectCircularDependencies,
  checkUpstreamResolution,
  batchFetchLinkedTickets,
} from './dependency-chain-validator';

// --- Epic Health Score ---
export {
  calculateEpicHealthScore,
  scoreCriteriaCoverage,
  scoreProgressVsEstimate,
  scoreStaleness,
  scoreBlockerHealth,
  scoreDocumentationQuality,
} from './epic-health-scorer';

// --- Stale Detection ---
export {
  detectStaleTickets,
  classifyStaleness,
  suggestAction,
  generateStalenessComment,
  autoTriageStaleTickets,
} from './stale-detector';
