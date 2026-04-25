// [UI-ADS-001] All colors via @atlaskit/tokens design token names (not hex values)
// [ARCH-SOLID-231] UPPER_SNAKE_CASE for constants
// [ARCH-SOLID-232] Named exports only, no default export
// [ARCH-SOLID-205] Explicit return types on all exported functions

import type { Severity } from '../../../../backend/types/inconsistency';

// ═══════════════════════════════════════════
// DESIGN TOKEN NAME CONSTANTS
// [UI-ADS-001] Token names from @atlaskit/tokens — resolved at render time
// ═══════════════════════════════════════════

export const SCORE_COLOR_TOKENS = {
  GREEN: 'color.text.success',
  YELLOW: 'color.text.warning',
  RED: 'color.text.error',
} as const;

export const STATUS_COLOR_TOKENS = {
  PASS: 'color.text.success',
  FAIL: 'color.text.error',
  WARNING: 'color.text.warning',
} as const;

export const SEVERITY_COLOR_TOKENS = {
  CRITICAL: 'color.text.error',
  WARNING: 'color.text.warning',
  INFO: 'color.text.subtlest',
} as const;

// ═══════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════

/**
 * Returns the design token name for a numeric score range.
 * > 80 = green, 60-80 = yellow, < 60 = red
 *
 * AC ref: AC-05 of theme.reqs.md
 * REGLA: UI-ADS-001 - color via design tokens
 */
export function getScoreColorToken(score: number): string {
  if (score > 80) return SCORE_COLOR_TOKENS.GREEN;
  if (score >= 60) return SCORE_COLOR_TOKENS.YELLOW;
  return SCORE_COLOR_TOKENS.RED;
}

/**
 * Returns the design token name for a pass/fail/warning status.
 *
 * AC ref: AC-06 of theme.reqs.md
 * REGLA: UI-ADS-001 - color via design tokens
 */
export function getStatusColorToken(status: 'pass' | 'fail' | 'warning'): string {
  switch (status) {
    case 'pass':
      return STATUS_COLOR_TOKENS.PASS;
    case 'fail':
      return STATUS_COLOR_TOKENS.FAIL;
    case 'warning':
      return STATUS_COLOR_TOKENS.WARNING;
  }
}

/**
 * Returns the design token name for an inconsistency severity level.
 *
 * AC ref: AC-07 of theme.reqs.md
 * REGLA: UI-ADS-001 - color via design tokens
 */
export function getSeverityColorToken(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return SEVERITY_COLOR_TOKENS.CRITICAL;
    case 'warning':
      return SEVERITY_COLOR_TOKENS.WARNING;
    case 'info':
      return SEVERITY_COLOR_TOKENS.INFO;
  }
}
