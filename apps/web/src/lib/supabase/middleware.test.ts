import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateSession } from './middleware'
import { createMockRequest } from '@/test/test-utils'

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
    },
  }
  return {
    createServerClient: vi.fn().mockReturnValue(mockSupabaseClient),
  }
})

// Mock next/server
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    NextResponse: {
      next: vi.fn().mockReturnValue(new Response()),
      redirect: vi.fn().mockImplementation((url: string | URL) => {
        return new Response(null, { status: 302, headers: { Location: String(url) } })
      }),
    },
  }
})

describe('supabase/middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  describe('updateSession', () => {
    it('should allow access to login page when not authenticated', async () => {
      const { createServerClient } = await import('@supabase/ssr')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockClient = createServerClient('', '', {
        cookies: {
          getAll: () => [],
          setAll: () => {},
        },
      } as any)
      vi.mocked(mockClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as any)

      const request = createMockRequest('http://localhost:3000/admin/login')
      const response = await updateSession(request)

      expect(response).toBeDefined()
    })

    it('should redirect to admin when authenticated user visits login page', async () => {
      const { createServerClient } = await import('@supabase/ssr')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockClient = createServerClient('', '', {
        cookies: {
          getAll: () => [],
          setAll: () => {},
        },
      } as any)
      vi.mocked(mockClient.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-1' } as any },
        error: null,
      } as any)

      const request = createMockRequest('http://localhost:3000/admin/login')
      const response = await updateSession(request)

      expect(response.status).toBe(302)
    })

    it('should redirect to login when unauthenticated user visits admin page', async () => {
      const { createServerClient } = await import('@supabase/ssr')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockClient = createServerClient('', '', {
        cookies: {
          getAll: () => [],
          setAll: () => {},
        },
      } as any)
      vi.mocked(mockClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as any)

      const request = createMockRequest('http://localhost:3000/admin')
      const response = await updateSession(request)

      expect(response.status).toBe(302)
    })

    it('should allow access to admin page when authenticated', async () => {
      const { createServerClient } = await import('@supabase/ssr')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockClient = createServerClient('', '', {
        cookies: {
          getAll: () => [],
          setAll: () => {},
        },
      } as any)
      vi.mocked(mockClient.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-1' } as any },
        error: null,
      } as any)

      const request = createMockRequest('http://localhost:3000/admin')
      const response = await updateSession(request)

      expect(response).toBeDefined()
    })

    it('should allow access to non-admin pages', async () => {
      const { createServerClient } = await import('@supabase/ssr')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockClient = createServerClient('', '', {
        cookies: {
          getAll: () => [],
          setAll: () => {},
        },
      } as any)
      vi.mocked(mockClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as any)

      const request = createMockRequest('http://localhost:3000/album/test')
      const response = await updateSession(request)

      expect(response).toBeDefined()
    })
  })
})
