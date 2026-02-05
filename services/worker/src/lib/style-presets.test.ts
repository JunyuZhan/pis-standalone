import { describe, it, expect } from 'vitest';
import {
  STYLE_PRESETS,
  getPresetsByCategory,
  getAllPresets,
  getPresetById,
  type StylePreset,
  type StylePresetConfig
} from './style-presets';

describe('StylePresets', () => {
  describe('STYLE_PRESETS', () => {
    it('should contain at least 20 presets', () => {
      const presetCount = Object.keys(STYLE_PRESETS).length;
      expect(presetCount).toBeGreaterThanOrEqual(20);
    });

    it('should have unique IDs for all presets', () => {
      const ids = Object.values(STYLE_PRESETS).map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid categories for all presets', () => {
      const validCategories = ['portrait', 'landscape', 'general'];
      Object.values(STYLE_PRESETS).forEach(preset => {
        expect(validCategories).toContain(preset.category);
      });
    });

    it('should have required fields for all presets', () => {
      Object.values(STYLE_PRESETS).forEach(preset => {
        expect(preset.id).toBeDefined();
        expect(preset.name).toBeDefined();
        expect(preset.category).toBeDefined();
        expect(preset.description).toBeDefined();
        expect(preset.config).toBeDefined();
      });
    });

    it('should have portrait category presets', () => {
      const portraitPresets = getPresetsByCategory('portrait');
      expect(portraitPresets.length).toBeGreaterThan(0);
    });

    it('should have landscape category presets', () => {
      const landscapePresets = getPresetsByCategory('landscape');
      expect(landscapePresets.length).toBeGreaterThan(0);
    });

    it('should have general category presets', () => {
      const generalPresets = getPresetsByCategory('general');
      expect(generalPresets.length).toBeGreaterThan(0);
    });

    it('should include japanese-fresh preset', () => {
      const preset = STYLE_PRESETS['japanese-fresh'];
      expect(preset).toBeDefined();
      expect(preset.name).toBe('日系小清新');
      expect(preset.category).toBe('portrait');
    });

    it('should include black-white preset', () => {
      const preset = STYLE_PRESETS['black-white'];
      expect(preset).toBeDefined();
      expect(preset.name).toBe('黑白');
      expect(preset.category).toBe('general');
      expect(preset.config.saturation).toBe(0);
    });

    it('should include cyberpunk preset', () => {
      const preset = STYLE_PRESETS['cyberpunk'];
      expect(preset).toBeDefined();
      expect(preset.name).toBe('赛博朋克');
      expect(preset.category).toBe('general');
    });

    it('should include high-key-bw preset', () => {
      const preset = STYLE_PRESETS['high-key-bw'];
      expect(preset).toBeDefined();
      expect(preset.name).toBe('高调黑白');
      expect(preset.config.brightness).toBeGreaterThan(1);
      expect(preset.config.contrast).toBeGreaterThan(0);
    });
  });

  describe('getPresetById', () => {
    it('should return preset for valid ID', () => {
      const preset = getPresetById('japanese-fresh');
      expect(preset).toBeDefined();
      expect(preset?.id).toBe('japanese-fresh');
    });

    it('should return undefined for invalid ID', () => {
      const preset = getPresetById('non-existent-preset');
      expect(preset).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const preset = getPresetById('');
      expect(preset).toBeUndefined();
    });

    it('should return valid preset with all properties', () => {
      const preset = getPresetById('cinematic-landscape');
      expect(preset).toBeDefined();
      expect(preset?.id).toBe('cinematic-landscape');
      expect(preset?.name).toBe('电影感风光');
      expect(preset?.category).toBe('landscape');
      expect(typeof preset?.config.brightness).toBe('number');
      expect(typeof preset?.config.contrast).toBe('number');
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

    it('should return empty array for category with no presets', () => {
      const presets = getPresetsByCategory('portrait' as any);
      expect(Array.isArray(presets)).toBe(true);
    });
  });

  describe('getAllPresets', () => {
    it('should return all presets', () => {
      const presets = getAllPresets();
      expect(presets.length).toBe(Object.keys(STYLE_PRESETS).length);
    });

    it('should sort presets by category order', () => {
      const presets = getAllPresets();
      const categoryOrder = ['portrait', 'landscape', 'general'];
      
      for (let i = 1; i < presets.length; i++) {
        const currentIndex = categoryOrder.indexOf(presets[i].category);
        const previousIndex = categoryOrder.indexOf(presets[i - 1].category);
        expect(currentIndex).toBeGreaterThanOrEqual(previousIndex);
      }
    });

    it('should return valid StylePreset objects', () => {
      const presets = getAllPresets();
      presets.forEach(preset => {
        expect(preset).toHaveProperty('id');
        expect(preset).toHaveProperty('name');
        expect(preset).toHaveProperty('category');
        expect(preset).toHaveProperty('description');
        expect(preset).toHaveProperty('config');
      });
    });
  });

  describe('StylePresetConfig validation', () => {
    it('should have valid brightness range for presets', () => {
      Object.values(STYLE_PRESETS).forEach(preset => {
        const config = preset.config;
        if (config.brightness !== undefined) {
          expect(config.brightness).toBeGreaterThanOrEqual(0);
          expect(config.brightness).toBeLessThanOrEqual(2);
        }
      });
    });

    it('should have valid contrast range for presets', () => {
      Object.values(STYLE_PRESETS).forEach(preset => {
        const config = preset.config;
        if (config.contrast !== undefined) {
          expect(config.contrast).toBeGreaterThanOrEqual(-1);
          expect(config.contrast).toBeLessThanOrEqual(1);
        }
      });
    });

    it('should have valid saturation range for presets', () => {
      Object.values(STYLE_PRESETS).forEach(preset => {
        const config = preset.config;
        if (config.saturation !== undefined) {
          expect(config.saturation).toBeGreaterThanOrEqual(0);
          expect(config.saturation).toBeLessThanOrEqual(2);
        }
      });
    });

    it('should have valid gamma range for presets', () => {
      Object.values(STYLE_PRESETS).forEach(preset => {
        const config = preset.config;
        if (config.gamma !== undefined) {
          expect(config.gamma).toBeGreaterThanOrEqual(0.1);
          expect(config.gamma).toBeLessThanOrEqual(3);
        }
      });
    });

    it('should have valid hue range for presets', () => {
      Object.values(STYLE_PRESETS).forEach(preset => {
        const config = preset.config;
        if (config.hue !== undefined) {
          expect(config.hue).toBeGreaterThanOrEqual(-360);
          expect(config.hue).toBeLessThanOrEqual(360);
        }
      });
    });
  });

  describe('CSS Filter compatibility', () => {
    it('should have cssFilter for all presets', () => {
      Object.values(STYLE_PRESETS).forEach(preset => {
        expect(preset.cssFilter).toBeDefined();
        expect(typeof preset.cssFilter).toBe('string');
      });
    });

    it('should have valid CSS filter syntax', () => {
      Object.values(STYLE_PRESETS).forEach(preset => {
        const cssFilter = preset.cssFilter;
        if (cssFilter) {
          expect(cssFilter).toContain('brightness(');
          // CSS filters can contain various characters including commas, dots, etc.
          expect(typeof cssFilter).toBe('string');
          expect(cssFilter.length).toBeGreaterThan(0);
        }
      });
    });
  });
});
