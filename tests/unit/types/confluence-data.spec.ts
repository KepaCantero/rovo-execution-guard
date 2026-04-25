// Test suite for ConfluencePageData and ConfluencePageMetadata domain types
// Covers: page data structure, metadata structure, readonly labels, version
// Tests: happy path, edge cases, field verification

import type {
  ConfluencePageData,
  ConfluencePageMetadata,
} from '../../../src/backend/types/confluence-data';

// ---------------------------------------------------------------------------
// ConfluencePageData
// ---------------------------------------------------------------------------

describe('ConfluencePageData', () => {
  describe('happy path', () => {
    it('should accept a valid ConfluencePageData', () => {
      // Arrange & Act
      const page: ConfluencePageData = {
        id: 'page-001',
        title: 'Architecture Overview',
        content: 'This document describes the system architecture...',
        spaceKey: 'ENG',
        url: 'https://confluence.example.com/pages/page-001',
        lastUpdated: '2026-03-15T10:00:00Z',
      };

      // Assert
      expect(page.id).toBe('page-001');
      expect(page.title).toBe('Architecture Overview');
      expect(page.content).toContain('architecture');
      expect(page.spaceKey).toBe('ENG');
      expect(page.url).toContain('page-001');
      expect(page.lastUpdated).toBe('2026-03-15T10:00:00Z');
    });
  });

  describe('edge cases', () => {
    it('should accept empty strings for all fields', () => {
      // Arrange & Act
      const page: ConfluencePageData = {
        id: '',
        title: '',
        content: '',
        spaceKey: '',
        url: '',
        lastUpdated: '',
      };

      // Assert
      expect(page.id).toBe('');
      expect(page.title).toBe('');
      expect(page.content).toBe('');
      expect(page.spaceKey).toBe('');
      expect(page.url).toBe('');
      expect(page.lastUpdated).toBe('');
    });

    it('should accept very long content', () => {
      // Arrange
      const longContent = 'A'.repeat(10000);

      // Act
      const page: ConfluencePageData = {
        id: 'page-long',
        title: 'Long Content Page',
        content: longContent,
        spaceKey: 'ENG',
        url: 'https://confluence.example.com/pages/page-long',
        lastUpdated: '2026-04-01T00:00:00Z',
      };

      // Assert
      expect(page.content).toHaveLength(10000);
    });

    it('should verify all six required properties exist', () => {
      // Arrange
      const page: ConfluencePageData = {
        id: 'p',
        title: 't',
        content: 'c',
        spaceKey: 's',
        url: 'u',
        lastUpdated: 'l',
      };

      // Act
      const keys = Object.keys(page);

      // Assert
      expect(keys).toHaveLength(6);
      expect(keys).toContain('id');
      expect(keys).toContain('title');
      expect(keys).toContain('content');
      expect(keys).toContain('spaceKey');
      expect(keys).toContain('url');
      expect(keys).toContain('lastUpdated');
    });
  });
});

// ---------------------------------------------------------------------------
// ConfluencePageMetadata
// ---------------------------------------------------------------------------

describe('ConfluencePageMetadata', () => {
  describe('happy path', () => {
    it('should accept a valid ConfluencePageMetadata', () => {
      // Arrange & Act
      const metadata: ConfluencePageMetadata = {
        id: 'page-002',
        title: 'API Design Guidelines',
        spaceKey: 'ENG',
        labels: ['api', 'guidelines', 'rest'],
        version: 3,
        lastUpdated: '2026-02-28T14:30:00Z',
      };

      // Assert
      expect(metadata.id).toBe('page-002');
      expect(metadata.title).toBe('API Design Guidelines');
      expect(metadata.spaceKey).toBe('ENG');
      expect(metadata.labels).toEqual(['api', 'guidelines', 'rest']);
      expect(metadata.version).toBe(3);
      expect(metadata.lastUpdated).toBe('2026-02-28T14:30:00Z');
    });
  });

  describe('edge cases', () => {
    it('should accept metadata with empty labels', () => {
      // Arrange & Act
      const metadata: ConfluencePageMetadata = {
        id: 'page-003',
        title: 'Untitled',
        spaceKey: 'TMP',
        labels: [],
        version: 1,
        lastUpdated: '2026-01-01T00:00:00Z',
      };

      // Assert
      expect(metadata.labels).toHaveLength(0);
      expect(metadata.version).toBe(1);
    });

    it('should accept version zero', () => {
      // Arrange & Act
      const metadata: ConfluencePageMetadata = {
        id: 'page-v0',
        title: 'Draft',
        spaceKey: 'DRAFT',
        labels: [],
        version: 0,
        lastUpdated: '2026-01-01T00:00:00Z',
      };

      // Assert
      expect(metadata.version).toBe(0);
    });

    it('should accept large version number', () => {
      // Arrange & Act
      const metadata: ConfluencePageMetadata = {
        id: 'page-many',
        title: 'Frequently Updated',
        spaceKey: 'ENG',
        labels: ['active'],
        version: 999,
        lastUpdated: '2026-04-05T00:00:00Z',
      };

      // Assert
      expect(metadata.version).toBe(999);
    });

    it('should accept empty strings for id, title, and spaceKey', () => {
      // Arrange & Act
      const metadata: ConfluencePageMetadata = {
        id: '',
        title: '',
        spaceKey: '',
        labels: [],
        version: 1,
        lastUpdated: '',
      };

      // Assert
      expect(metadata.id).toBe('');
      expect(metadata.title).toBe('');
      expect(metadata.spaceKey).toBe('');
      expect(metadata.lastUpdated).toBe('');
    });

    it('should verify all six properties exist', () => {
      // Arrange
      const metadata: ConfluencePageMetadata = {
        id: 'p',
        title: 't',
        spaceKey: 's',
        labels: ['l'],
        version: 1,
        lastUpdated: 'd',
      };

      // Act
      const keys = Object.keys(metadata);

      // Assert
      expect(keys).toHaveLength(6);
      expect(keys).toContain('id');
      expect(keys).toContain('title');
      expect(keys).toContain('spaceKey');
      expect(keys).toContain('labels');
      expect(keys).toContain('version');
      expect(keys).toContain('lastUpdated');
    });

    it('should allow iterating over readonly labels', () => {
      // Arrange
      const metadata: ConfluencePageMetadata = {
        id: 'page-iter',
        title: 'Iter Test',
        spaceKey: 'ENG',
        labels: ['alpha', 'beta', 'gamma'],
        version: 1,
        lastUpdated: '2026-04-05T00:00:00Z',
      };

      // Act
      const upperLabels = metadata.labels.map((l) => l.toUpperCase());

      // Assert
      expect(upperLabels).toEqual(['ALPHA', 'BETA', 'GAMMA']);
    });
  });

  describe('relationship with ConfluencePageData', () => {
    it('should share id, title, spaceKey, lastUpdated field names', () => {
      // Arrange
      const page: ConfluencePageData = {
        id: 'shared-id',
        title: 'Shared Title',
        content: 'c',
        spaceKey: 'ENG',
        url: 'https://example.com',
        lastUpdated: '2026-01-01',
      };
      const metadata: ConfluencePageMetadata = {
        id: 'shared-id',
        title: 'Shared Title',
        spaceKey: 'ENG',
        labels: [],
        version: 1,
        lastUpdated: '2026-01-01',
      };

      // Assert
      expect(page.id).toBe(metadata.id);
      expect(page.title).toBe(metadata.title);
      expect(page.spaceKey).toBe(metadata.spaceKey);
      expect(page.lastUpdated).toBe(metadata.lastUpdated);
    });
  });
});
