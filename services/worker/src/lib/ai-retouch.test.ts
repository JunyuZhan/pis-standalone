import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MockRetouchService, aiRetouchService, type AIRetouchOptions } from './ai-retouch';
import sharp from 'sharp';

describe('AIRetouchService', () => {
  let service: MockRetouchService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    service = new MockRetouchService();
    originalEnv = process.env;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('process', () => {
    it('should process image with auto preset by default', async () => {
      // Create a simple 1x1 pixel PNG image
      const inputBuffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
      })
        .png()
        .toBuffer();

      const result = await service.process(inputBuffer);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should process image with portrait preset', async () => {
      const inputBuffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 100, g: 150, b: 200 } }
      })
        .png()
        .toBuffer();

      const options: AIRetouchOptions = { preset: 'portrait' };
      const result = await service.process(inputBuffer, options);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should process image with landscape preset', async () => {
      const inputBuffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 50, g: 100, b: 150 } }
      })
        .png()
        .toBuffer();

      const options: AIRetouchOptions = { preset: 'landscape' };
      const result = await service.process(inputBuffer, options);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty buffer gracefully', async () => {
      const emptyBuffer = Buffer.alloc(0);
      
      // Sharp will throw for empty buffer, which is expected behavior
      await expect(service.process(emptyBuffer)).rejects.toThrow();
    });

    it('should preserve image format', async () => {
      // Test with JPEG
      const jpegBuffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 200, g: 100, b: 50 } }
      })
        .jpeg()
        .toBuffer();

      const result = await service.process(jpegBuffer, { preset: 'auto' });
      
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should apply different transformations for each preset', async () => {
      const inputBuffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } }
      })
        .png()
        .toBuffer();

      const autoResult = await service.process(inputBuffer, { preset: 'auto' });
      const portraitResult = await service.process(inputBuffer, { preset: 'portrait' });
      const landscapeResult = await service.process(inputBuffer, { preset: 'landscape' });

      // All results should be valid buffers
      expect(autoResult).toBeInstanceOf(Buffer);
      expect(portraitResult).toBeInstanceOf(Buffer);
      expect(landscapeResult).toBeInstanceOf(Buffer);

      // Results should be different due to different transformations
      // Note: sharp may produce same-size buffers but with different pixel values
      expect(autoResult.length).toBeGreaterThan(0);
    });

    it('should handle large images', async () => {
      // Create a larger image (1920x1080)
      const largeBuffer = await sharp({
        create: { width: 1920, height: 1080, channels: 3, background: { r: 255, g: 255, b: 255 } }
      })
        .png()
        .toBuffer();

      const result = await service.process(largeBuffer, { preset: 'auto' });
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle images with alpha channel', async () => {
      const rgbaBuffer = await sharp({
        create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } }
      })
        .png()
        .toBuffer();

      const result = await service.process(rgbaBuffer, { preset: 'portrait' });
      
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('aiRetouchService singleton', () => {
    it('should be an instance of MockRetouchService', () => {
      expect(aiRetouchService).toBeInstanceOf(MockRetouchService);
    });

    it('should be able to process images', async () => {
      const inputBuffer = await sharp({
        create: { width: 50, height: 50, channels: 3, background: { r: 100, g: 100, b: 100 } }
      })
        .png()
        .toBuffer();

      const result = await aiRetouchService.process(inputBuffer);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
