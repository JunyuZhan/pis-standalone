import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';

// We need to test the exported functions and class
// Import module to access exports
import { 
  getAlbumCache, 
  clearAlbumCache, 
  destroyAlbumCache 
} from './album-cache';
import type { CachedAlbum } from './album-cache';

describe('AlbumCache Singleton Functions', () => {
  beforeEach(() => {
    // Ensure we start with a clean state
    destroyAlbumCache();
  });

  afterEach(() => {
    // Clean up after each test
    destroyAlbumCache();
    vi.restoreAllMocks();
  });

  describe('getAlbumCache', () => {
    it('should return singleton instance', () => {
      const cache1 = getAlbumCache();
      const cache2 = getAlbumCache();
      expect(cache1).toBe(cache2);
    });

    it('should create new instance if none exists', () => {
      const cache = getAlbumCache();
      expect(cache).toBeDefined();
      expect(typeof cache.get).toBe('function');
      expect(typeof cache.set).toBe('function');
    });

    it('should be able to store and retrieve data', () => {
      const cache = getAlbumCache();
      const testData = {
        id: 'test-album',
        watermark_enabled: true,
        watermark_type: 'text',
        watermark_config: { text: 'Test' }
      };
      
      cache.set('test-album', testData);
      const result = cache.get('test-album');
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe('test-album');
      expect(result?.watermark_enabled).toBe(true);
    });
  });

  describe('clearAlbumCache', () => {
    it('should clear the singleton cache', () => {
      const cache = getAlbumCache();
      cache.set('album-1', { id: 'album-1', watermark_enabled: false, watermark_type: null, watermark_config: null });
      cache.set('album-2', { id: 'album-2', watermark_enabled: false, watermark_type: null, watermark_config: null });

      expect(cache.size()).toBe(2);

      clearAlbumCache();

      expect(cache.size()).toBe(0);
    });

    it('should handle clearing empty cache', () => {
      const cache = getAlbumCache();
      clearAlbumCache();
      expect(cache.size()).toBe(0);
    });
  });

  describe('destroyAlbumCache', () => {
    it('should destroy singleton and allow recreation', () => {
      const cache1 = getAlbumCache();
      cache1.set('album-1', { id: 'album-1', watermark_enabled: false, watermark_type: null, watermark_config: null });

      destroyAlbumCache();

      const cache2 = getAlbumCache();
      expect(cache2.size()).toBe(0);
      expect(cache2).not.toBe(cache1);
    });

    it('should handle multiple destroy calls', () => {
      const cache = getAlbumCache();
      cache.set('album-1', { id: 'album-1', watermark_enabled: false, watermark_type: null, watermark_config: null });

      destroyAlbumCache();
      destroyAlbumCache(); // Should not throw

      expect(cache.size()).toBe(0);
    });
  });
});

describe('AlbumCache Type Tests', () => {
  it('should accept correct album structure', () => {
    const album: CachedAlbum = {
      id: 'test-album',
      watermark_enabled: true,
      watermark_type: 'text',
      watermark_config: { text: 'Test Watermark', position: 'bottom-right' },
      color_grading: { preset: 'japanese-fresh' },
      cachedAt: Date.now()
    };

    expect(album.id).toBe('test-album');
    expect(album.watermark_enabled).toBe(true);
    expect(album.cachedAt).toBeDefined();
  });

  it('should accept album with null watermark fields', () => {
    const album: CachedAlbum = {
      id: 'test-album',
      watermark_enabled: false,
      watermark_type: null,
      watermark_config: null,
      cachedAt: Date.now()
    };

    expect(album.watermark_type).toBeNull();
    expect(album.watermark_config).toBeNull();
  });

  it('should accept album without color_grading', () => {
    const album: CachedAlbum = {
      id: 'test-album',
      watermark_enabled: false,
      watermark_type: null,
      watermark_config: null,
      cachedAt: Date.now()
    };

    expect(album.color_grading).toBeUndefined();
  });
});
