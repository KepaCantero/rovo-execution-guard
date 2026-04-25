/**
 * Tests for admin-dashboard/styles/theme.ts
 *
 * Verifies score range colors, status colors, severity colors,
 * and token-based color naming (no hex values).
 */

import {
  SCORE_COLOR_TOKENS,
  STATUS_COLOR_TOKENS,
  SEVERITY_COLOR_TOKENS,
  getScoreColorToken,
  getStatusColorToken,
  getSeverityColorToken,
} from '../../../../../src/frontend/custom-ui/admin-dashboard/styles/theme';

// ═══════════════════════════════════════════
// MOCKS & FIXTURES
// ═══════════════════════════════════════════

const HEX_PATTERN = /^#[0-9a-fA-F]{3,8}$/;
const RGB_PATTERN = /^rgba?\(/;

function isHexOrRgb(value: string): boolean {
  return HEX_PATTERN.test(value) || RGB_PATTERN.test(value);
}

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('admin-dashboard/styles/theme', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Score Color Constants (AC-01) ──────

  describe('SCORE_COLOR_TOKENS', () => {
    it('should define GREEN, YELLOW, RED token names (AC-01, AC-03)', () => {
      expect(SCORE_COLOR_TOKENS.GREEN).toBeDefined();
      expect(SCORE_COLOR_TOKENS.YELLOW).toBeDefined();
      expect(SCORE_COLOR_TOKENS.RED).toBeDefined();
    });

    it('should NOT contain hex or RGB values (AC-08, UI-ADS-001)', () => {
      const values = Object.values(SCORE_COLOR_TOKENS);
      for (const value of values) {
        expect(isHexOrRgb(value)).toBe(false);
      }
    });

    it('should use dot-separated token naming convention (UI-ADS-001)', () => {
      const values = Object.values(SCORE_COLOR_TOKENS);
      for (const value of values) {
        expect(value).toContain('color.');
      }
    });
  });

  // ─── Status Color Constants (AC-02) ──────

  describe('STATUS_COLOR_TOKENS', () => {
    it('should define PASS, FAIL, WARNING token names (AC-02, AC-03)', () => {
      expect(STATUS_COLOR_TOKENS.PASS).toBeDefined();
      expect(STATUS_COLOR_TOKENS.FAIL).toBeDefined();
      expect(STATUS_COLOR_TOKENS.WARNING).toBeDefined();
    });

    it('should NOT contain hex or RGB values (AC-08, UI-ADS-001)', () => {
      const values = Object.values(STATUS_COLOR_TOKENS);
      for (const value of values) {
        expect(isHexOrRgb(value)).toBe(false);
      }
    });
  });

  // ─── Severity Color Constants ────────────

  describe('SEVERITY_COLOR_TOKENS', () => {
    it('should define CRITICAL, WARNING, INFO token names (AC-03)', () => {
      expect(SEVERITY_COLOR_TOKENS.CRITICAL).toBeDefined();
      expect(SEVERITY_COLOR_TOKENS.WARNING).toBeDefined();
      expect(SEVERITY_COLOR_TOKENS.INFO).toBeDefined();
    });

    it('should NOT contain hex or RGB values (AC-08, UI-ADS-001)', () => {
      const values = Object.values(SEVERITY_COLOR_TOKENS);
      for (const value of values) {
        expect(isHexOrRgb(value)).toBe(false);
      }
    });
  });

  // ─── getScoreColorToken() (AC-05) ────────

  describe('getScoreColorToken()', () => {

    it('should return GREEN token for score > 80 (AC-05)', () => {
      expect(getScoreColorToken(81)).toBe(SCORE_COLOR_TOKENS.GREEN);
      expect(getScoreColorToken(100)).toBe(SCORE_COLOR_TOKENS.GREEN);
      expect(getScoreColorToken(99.9)).toBe(SCORE_COLOR_TOKENS.GREEN);
    });

    it('should return YELLOW token for score 60-80 (AC-05)', () => {
      expect(getScoreColorToken(80)).toBe(SCORE_COLOR_TOKENS.YELLOW);
      expect(getScoreColorToken(60)).toBe(SCORE_COLOR_TOKENS.YELLOW);
      expect(getScoreColorToken(70)).toBe(SCORE_COLOR_TOKENS.YELLOW);
    });

    it('should return RED token for score < 60 (AC-05)', () => {
      expect(getScoreColorToken(59)).toBe(SCORE_COLOR_TOKENS.RED);
      expect(getScoreColorToken(0)).toBe(SCORE_COLOR_TOKENS.RED);
      expect(getScoreColorToken(59.9)).toBe(SCORE_COLOR_TOKENS.RED);
    });

    it('should handle boundary score 80 correctly', () => {
      expect(getScoreColorToken(80)).toBe(SCORE_COLOR_TOKENS.YELLOW);
      expect(getScoreColorToken(81)).toBe(SCORE_COLOR_TOKENS.GREEN);
    });

    it('should handle boundary score 60 correctly', () => {
      expect(getScoreColorToken(60)).toBe(SCORE_COLOR_TOKENS.YELLOW);
      expect(getScoreColorToken(59)).toBe(SCORE_COLOR_TOKENS.RED);
    });

    it('should handle boundary score 0 correctly', () => {
      expect(getScoreColorToken(0)).toBe(SCORE_COLOR_TOKENS.RED);
    });

    it('should handle boundary score 100 correctly', () => {
      expect(getScoreColorToken(100)).toBe(SCORE_COLOR_TOKENS.GREEN);
    });

    it('should return a string value with no hex (ARCH-SOLID-205, UI-ADS-001)', () => {
      const result = getScoreColorToken(75);
      expect(typeof result).toBe('string');
      expect(isHexOrRgb(result)).toBe(false);
    });
  });

  // ─── getStatusColorToken() (AC-06) ──────

  describe('getStatusColorToken()', () => {

    it('should return PASS token for "pass" status (AC-06)', () => {
      expect(getStatusColorToken('pass')).toBe(STATUS_COLOR_TOKENS.PASS);
    });

    it('should return FAIL token for "fail" status (AC-06)', () => {
      expect(getStatusColorToken('fail')).toBe(STATUS_COLOR_TOKENS.FAIL);
    });

    it('should return WARNING token for "warning" status (AC-06)', () => {
      expect(getStatusColorToken('warning')).toBe(STATUS_COLOR_TOKENS.WARNING);
    });

    it('should return a string value with no hex for all statuses', () => {
      const statuses: readonly ('pass' | 'fail' | 'warning')[] = ['pass', 'fail', 'warning'];
      for (const status of statuses) {
        const result = getStatusColorToken(status);
        expect(typeof result).toBe('string');
        expect(isHexOrRgb(result)).toBe(false);
      }
    });
  });

  // ─── getSeverityColorToken() (AC-07) ─────

  describe('getSeverityColorToken()', () => {

    it('should return CRITICAL token for "critical" severity (AC-07)', () => {
      expect(getSeverityColorToken('critical')).toBe(SEVERITY_COLOR_TOKENS.CRITICAL);
    });

    it('should return WARNING token for "warning" severity (AC-07)', () => {
      expect(getSeverityColorToken('warning')).toBe(SEVERITY_COLOR_TOKENS.WARNING);
    });

    it('should return INFO token for "info" severity (AC-07)', () => {
      expect(getSeverityColorToken('info')).toBe(SEVERITY_COLOR_TOKENS.INFO);
    });

    it('should return a string value with no hex for all severities', () => {
      const severities: readonly ('critical' | 'warning' | 'info')[] = ['critical', 'warning', 'info'];
      for (const severity of severities) {
        const result = getSeverityColorToken(severity);
        expect(typeof result).toBe('string');
        expect(isHexOrRgb(result)).toBe(false);
      }
    });
  });

});
