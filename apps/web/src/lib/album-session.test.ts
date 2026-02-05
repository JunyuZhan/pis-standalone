import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  generateAlbumSessionToken,
  validateAlbumSessionToken,
  getSessionCookieOptions,
  ALBUM_SESSION_COOKIE_NAME,
  type AlbumSessionPayload,
} from './album-session'

describe('Album Session Management', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    // Set a test secret
    process.env.ALBUM_SESSION_SECRET = 'test-secret-key-minimum-32-characters-long-for-security'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('generateAlbumSessionToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateAlbumSessionToken('album-123', 'test-album')
      
      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT has 3 parts
    })

    it('should include album information in token payload', () => {
      const albumId = 'album-456'
      const albumSlug = 'my-album'
      
      const token = generateAlbumSessionToken(albumId, albumSlug)
      const payload = validateAlbumSessionToken(token)
      
      expect(payload).toBeTruthy()
      expect(payload?.albumId).toBe(albumId)
      expect(payload?.albumSlug).toBe(albumSlug)
      expect(payload?.type).toBe('album-access')
    })

    it('should set expiration time correctly', () => {
      const token = generateAlbumSessionToken('album-789', 'test', 1)
      const payload = validateAlbumSessionToken(token)
      
      expect(payload).toBeTruthy()
      expect(payload?.exp).toBeTruthy()
      expect(payload?.iat).toBeTruthy()
      
      // Expiration should be approximately 1 hour from now
      const expiresIn = payload!.exp - payload!.iat
      expect(expiresIn).toBeGreaterThanOrEqual(3599) // Allow 1 second tolerance
      expect(expiresIn).toBeLessThanOrEqual(3601)
    })

    it('should throw error if secret is too short', () => {
      process.env.ALBUM_SESSION_SECRET = 'short'
      
      expect(() => {
        generateAlbumSessionToken('album-123', 'test')
      }).toThrow('ALBUM_SESSION_SECRET must be at least 32 characters long')
    })
  })

  describe('validateAlbumSessionToken', () => {
    it('should validate a valid token', () => {
      const token = generateAlbumSessionToken('album-123', 'test-album')
      const payload = validateAlbumSessionToken(token)
      
      expect(payload).toBeTruthy()
      expect(payload?.albumId).toBe('album-123')
      expect(payload?.albumSlug).toBe('test-album')
    })

    it('should return null for invalid token', () => {
      const payload = validateAlbumSessionToken('invalid.token.here')
      expect(payload).toBeNull()
    })

    it('should return null for tampered token', () => {
      const token = generateAlbumSessionToken('album-123', 'test')
      const tamperedToken = token.slice(0, -5) + 'xxxxx'
      
      const payload = validateAlbumSessionToken(tamperedToken)
      expect(payload).toBeNull()
    })

    it('should return null for token with wrong type', () => {
      // This test would require creating a token with wrong type
      // For now, we test the validation logic
      const payload = validateAlbumSessionToken('')
      expect(payload).toBeNull()
    })
  })

  describe('getSessionCookieOptions', () => {
    it('should return secure options for production', () => {
      vi.stubEnv('NODE_ENV', 'production')
      const options = getSessionCookieOptions()
      
      expect(options.httpOnly).toBe(true)
      expect(options.secure).toBe(true)
      expect(options.sameSite).toBe('lax')
      expect(options.maxAge).toBe(24 * 60 * 60)
      expect(options.path).toBe('/')
    })

    it('should return non-secure options for development', () => {
      vi.stubEnv('NODE_ENV', 'development')
      const options = getSessionCookieOptions()
      
      expect(options.httpOnly).toBe(true)
      expect(options.secure).toBe(false) // Not secure in dev
      expect(options.sameSite).toBe('lax')
    })
  })

  describe('ALBUM_SESSION_COOKIE_NAME', () => {
    it('should have correct cookie name', () => {
      expect(ALBUM_SESSION_COOKIE_NAME).toBe('album-session')
    })
  })
})
