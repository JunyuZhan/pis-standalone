import { describe, it, expect } from 'vitest';
import { 
  STYLE_PRESETS, 
  getPresetsByCategory,
  getAllPresets, 
  getPresetById,
  type StylePreset,
  type StylePresetConfig 
} from './style-preset-utils';

describe('style-preset-utils', () => {
  describe('STYLE_PRESETS', () => {
    it('should contain all preset definitions', () => {
      const presets = Object.keys(STYLE_PRESETS);
      expect(presets.length).toBeGreaterThan(0);
    });

    it('should have valid preset structure', () => {
      Object.entries(STYLE_PRESETS).forEach(([id, preset]) => {
        expect(preset).toHaveProperty('id', id);
        expect(preset).toHaveProperty('name');
        expect(preset).toHaveProperty('category');
        expect(preset).toHaveProperty('description');
        expect(preset).toHaveProperty('config');
      });
    });

    it('should have valid category values', () => {
      const validCategories = ['portrait', 'landscape', 'general'];
      Object.values(STYLE_PRESETS).forEach(preset => {
        expect(validCategories).toContain(preset.category);
      });
    });

    it('should have numeric config values', () => {
      Object.values(STYLE_PRESETS).forEach(preset => {
        const config = preset.config;
        if (config.brightness !== undefined) expect(typeof config.brightness).toBe('number');
        if (config.contrast !== undefined) expect(typeof config.contrast).toBe('number');
        if (config.saturation !== undefined) expect(typeof config.saturation).toBe('number');
      });
    });
  });

  describe('getPresetById', () => {
    it('should return preset for valid id', () => {
      const preset = getPresetById('japanese-fresh');
      expect(preset).toBeDefined();
      expect(preset?.id).toBe('japanese-fresh');
    });

    it('should return undefined for invalid id', () => {
      const preset = getPresetById('nonexistent');
      expect(preset).toBeUndefined();
    });

    it('should handle empty string', () => {
      const preset = getPresetById('');
      expect(preset).toBeUndefined();
    });
  });

  describe('getPresetsByCategory', () => {
    it('should return only portrait presets for portrait category', () => {
      const presets = getPresetsByCategory('portrait');
      expect(presets.length).toBeGreaterThan(0);
      presets.forEach(preset => {
        expect(preset.category).toBe('portrait');
      });
    });

    it('should return only landscape presets for landscape category', () => {
      const presets = getPresetsByCategory('landscape');
      expect(presets.length).toBeGreaterThan(0);
      presets.forEach(preset => {
        expect(preset.category).toBe('landscape');
      });
    });

    it('should return only general presets for general category', () => {
      const presets = getPresetsByCategory('general');
      expect(presets.length).toBeGreaterThan(0);
      presets.forEach(preset => {
        expect(preset.category).toBe('general');
      });
    });
  });

  describe('getAllPresets', () => {
    it('should return all presets', () => {
      const presets = getAllPresets();
      expect(presets.length).toBe(Object.keys(STYLE_PRESETS).length);
    });

    it('should return array of presets', () => {
      const presets = getAllPresets();
      expect(Array.isArray(presets)).toBe(true);
    });
  });
});
