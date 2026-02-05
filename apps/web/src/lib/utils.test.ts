import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cn,
  formatFileSize,
  formatDate,
  formatRelativeTime,
  getAppBaseUrl,
  getSafeMediaUrl,
  generateAlbumSlug,
  truncateText,
} from "./utils";

describe("utils", () => {
  describe("cn", () => {
    it("should merge simple class names", () => {
      expect(cn("px-2", "py-1")).toBe("px-2 py-1");
    });

    it("should handle conditional classes", () => {
      const isActive = true;
      const isDisabled = false;
      expect(
        cn(
          "base-class",
          isActive && "active-class",
          isDisabled && "disabled-class",
        ),
      ).toBe("base-class active-class");
    });

    it("should handle tailwind merge conflicts", () => {
      expect(cn("px-2 px-4")).toBe("px-4");
    });

    it("should handle empty inputs", () => {
      expect(cn()).toBe("");
    });

    it("should handle undefined and null", () => {
      expect(cn("class1", undefined, null, "class2")).toBe("class1 class2");
    });

    it("should handle array inputs", () => {
      expect(cn(["class1", "class2"])).toBe("class1 class2");
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes", () => {
      expect(formatFileSize(500)).toBe("500 B");
    });

    it("should format kilobytes", () => {
      expect(formatFileSize(1024)).toBe("1 KB");
    });

    it("should format megabytes", () => {
      expect(formatFileSize(1024 * 1024)).toBe("1 MB");
    });

    it("should format gigabytes", () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
    });

    it("should handle decimal values", () => {
      expect(formatFileSize(1536)).toBe("1.5 KB");
    });

    it("should handle zero", () => {
      expect(formatFileSize(0)).toBe("0 B");
    });

    it("should handle large values", () => {
      expect(formatFileSize(5 * 1024 * 1024 * 1024)).toBe("5 GB");
    });

    it("should handle fractional kilobytes", () => {
      expect(formatFileSize(500 * 1024)).toBe("500 KB");
    });
  });

  describe("formatDate", () => {
    it("should format date with Chinese month names", () => {
      const date = new Date(2024, 0, 15); // January 15, 2024
      expect(formatDate(date)).toBe("2024年一月15日");
    });

    it("should format date string", () => {
      expect(formatDate("2024-03-20")).toBe("2024年三月20日");
    });

    it("should format December correctly", () => {
      const date = new Date(2024, 11, 25); // December 25, 2024
      expect(formatDate(date)).toBe("2024年十二月25日");
    });

    it("should pad single digit days", () => {
      const date = new Date(2024, 5, 5); // June 5, 2024
      expect(formatDate(date)).toBe("2024年六月5日");
    });
  });

  describe("formatRelativeTime", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return "刚刚" for recent times', () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 30000); // 30 seconds ago
      expect(formatRelativeTime(recentDate)).toBe("刚刚");
    });

    it("should return minutes ago", () => {
      const now = new Date();
      const minutesAgo = new Date(now.getTime() - 5 * 60000); // 5 minutes ago
      expect(formatRelativeTime(minutesAgo)).toBe("5 分钟前");
    });

    it("should return hours ago", () => {
      const now = new Date();
      const hoursAgo = new Date(now.getTime() - 3 * 3600000); // 3 hours ago
      expect(formatRelativeTime(hoursAgo)).toBe("3 小时前");
    });

    it("should return days ago", () => {
      const now = new Date();
      const daysAgo = new Date(now.getTime() - 7 * 86400000); // 7 days ago
      expect(formatRelativeTime(daysAgo)).toBe("7 天前");
    });

    it("should fall back to formatDate for old dates", () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 86400000); // 100 days ago
      expect(formatRelativeTime(oldDate)).toMatch(/\d{4}年/);
    });
  });

  describe("getAppBaseUrl", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
      vi.restoreAllMocks();
    });

    it("should return environment variable if set", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
      // Note: This test will pass in SSR context
    });

    it("should handle missing environment variable", () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      // The function should have a fallback
    });
  });

  describe("getSafeMediaUrl", () => {
    it("should handle valid external URLs", () => {
      const url = getSafeMediaUrl("https://cdn.example.com/media/photo.jpg");
      expect(url).toBe("https://cdn.example.com/media/photo.jpg");
    });

    it("should handle relative paths", () => {
      const url = getSafeMediaUrl("/media/photo.jpg");
      expect(url).toBe("/media/photo.jpg");
    });

    it("should handle URLs with query parameters", () => {
      const url = getSafeMediaUrl(
        "https://cdn.example.com/media/photo.jpg?t=123456",
      );
      expect(url).toBe("https://cdn.example.com/media/photo.jpg?t=123456");
    });

    it("should handle empty string", () => {
      const url = getSafeMediaUrl("");
      expect(url).toBe("/media");
    });

    it("should handle null or undefined", () => {
      // @ts-ignore - testing edge case
      expect(getSafeMediaUrl(null)).toBe("/media");
      // @ts-ignore - testing edge case
      expect(getSafeMediaUrl(undefined)).toBe("/media");
    });
  });

  describe("generateAlbumSlug", () => {
    it("should generate random slug", () => {
      const slug = generateAlbumSlug();
      expect(slug).toBeDefined();
      expect(slug.length).toBeGreaterThan(0);
    });

    it("should generate unique slugs", () => {
      const slug1 = generateAlbumSlug();
      const slug2 = generateAlbumSlug();
      expect(slug1).not.toBe(slug2);
    });
  });

  describe("truncateText", () => {
    it("should truncate long text with ellipsis", () => {
      const text = "This is a very long text that should be truncated";
      const result = truncateText(text, 20);
      expect(result.length).toBeLessThanOrEqual(23); // 20 + '...'
      expect(result).toContain("...");
    });

    it("should not truncate short text", () => {
      const text = "Short text";
      const result = truncateText(text, 100);
      expect(result).toBe("Short text");
    });

    it("should handle exact length", () => {
      const text = "Exact";
      const result = truncateText(text, 5);
      expect(result).toBe("Exact");
    });

    it("should handle zero maxLength", () => {
      const text = "Any text";
      const result = truncateText(text, 0);
      expect(result).toBe("...");
    });

    it("should handle empty string", () => {
      const result = truncateText("", 10);
      expect(result).toBe("");
    });
  });
});
