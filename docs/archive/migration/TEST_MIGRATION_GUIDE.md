# 测试文件迁移指南

> 从 Supabase 测试迁移到 PostgreSQL 测试的指南

## 概述

由于项目已从 Supabase 迁移到 PostgreSQL，测试文件需要相应更新。本文档提供迁移指南和示例。

## 主要变更

### 1. Mock 导入变更

**之前（Supabase）:**
```typescript
vi.mock('@/lib/supabase/server', () => {
  return {
    createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
  }
})
```

**之后（PostgreSQL）:**
```typescript
vi.mock('@/lib/database', () => {
  const { createMockDatabaseClient } = require('@/test/test-utils')
  return {
    createClient: vi.fn().mockResolvedValue(createMockDatabaseClient()),
  }
})
```

### 2. 认证 Mock 变更

**之前（Supabase Auth）:**
```typescript
const mockClient = await createClient()
mockClient.auth.getUser.mockResolvedValue({
  data: { user: { id: '1', email: 'test@example.com' } },
  error: null,
})
```

**之后（自定义认证）:**
```typescript
vi.mock('@/lib/auth', () => ({
  getAuthDatabase: vi.fn(),
  verifyPassword: vi.fn(),
  createSession: vi.fn(),
  getCurrentUser: vi.fn(),
}))

const { getAuthDatabase, verifyPassword, createSession } = await import('@/lib/auth')
vi.mocked(getAuthDatabase).mockReturnValue({
  findUserByEmail: vi.fn().mockResolvedValue({
    id: '1',
    email: 'test@example.com',
    password_hash: 'hashed-password',
  }),
} as any)
vi.mocked(verifyPassword).mockResolvedValue(true)
```

### 3. 数据库查询 Mock 变更

**之前（Supabase）:**
```typescript
const mockSelect = vi.fn().mockReturnThis()
const mockIs = vi.fn().mockReturnThis()
const mockOrder = vi.fn().mockReturnThis()
const mockRange = vi.fn().mockResolvedValue({
  data: mockAlbums,
  error: null,
  count: 2,
})

mockClient.from.mockReturnValue({
  select: mockSelect,
  is: mockIs,
  order: mockOrder,
  range: mockRange,
})
```

**之后（PostgreSQL）:**
```typescript
const mockClient = createMockDatabaseClient({
  selectData: mockAlbums,
  count: 2,
})

mockClient.from('albums')
  .select('*')
  .is('deleted_at', null)
  .order('created_at', { ascending: false })
  .execute()
```

## 测试工具函数

### createMockDatabaseClient

新的测试工具函数，兼容 Supabase 和 PostgreSQL API：

```typescript
import { createMockDatabaseClient } from '@/test/test-utils'

const mockClient = createMockDatabaseClient({
  user: { id: '1', email: 'test@example.com' },
  selectData: [{ id: '1', title: 'Album 1' }],
  count: 1,
})
```

### createMockSupabaseClient（已弃用）

`createMockSupabaseClient` 仍然可用，但内部已重定向到 `createMockDatabaseClient`。

## 迁移步骤

### 步骤 1: 更新 Mock 导入

1. 将 `@/lib/supabase/server` 改为 `@/lib/database`
2. 使用 `createMockDatabaseClient` 代替 `createMockSupabaseClient`

### 步骤 2: 更新认证测试

1. 添加 `@/lib/auth` mock
2. Mock `getAuthDatabase`, `verifyPassword`, `createSession` 等函数
3. 更新测试断言

### 步骤 3: 更新数据库查询测试

1. 使用 `createMockDatabaseClient` 创建 mock 客户端
2. 更新查询链式调用（PostgreSQL 客户端 API 与 Supabase 类似）
3. 更新结果断言（注意返回结构可能略有不同）

### 步骤 4: 运行测试

```bash
pnpm test
```

## 示例：完整的测试文件迁移

### 之前（Supabase）

```typescript
vi.mock('@/lib/supabase/server', () => {
  const mockAuth = {
    getUser: vi.fn(),
  }
  return {
    createClient: vi.fn().mockResolvedValue({
      auth: mockAuth,
      from: vi.fn(),
    }),
  }
})

describe('GET /api/admin/albums', () => {
  beforeEach(async () => {
    const { createClient } = await import('@/lib/supabase/server')
    const mockClient = await createClient()
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: { id: '1', email: 'test@example.com' } },
      error: null,
    })
  })
})
```

### 之后（PostgreSQL）

```typescript
vi.mock('@/lib/database', () => {
  const { createMockDatabaseClient } = require('@/test/test-utils')
  return {
    createClient: vi.fn().mockResolvedValue(createMockDatabaseClient()),
  }
})

vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

describe('GET /api/admin/albums', () => {
  beforeEach(async () => {
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: '1',
      email: 'test@example.com',
    })
  })
})
```

## 常见问题

### Q: 测试失败，提示找不到 `@/lib/supabase/server`

A: 确保已更新所有 mock 导入，将 `@/lib/supabase/server` 改为 `@/lib/database`。

### Q: 认证测试失败

A: 确保已正确 mock `@/lib/auth` 模块的相关函数（`getAuthDatabase`, `verifyPassword`, `createSession`）。

### Q: 数据库查询测试失败

A: 检查查询链式调用是否正确，PostgreSQL 客户端的 API 与 Supabase 类似但可能略有不同。

## 待迁移的测试文件

以下测试文件需要迁移（按优先级排序）：

1. ✅ `app/api/auth/login/route.test.ts` - 已更新
2. ⏳ `app/api/auth/signout/route.test.ts` - 待更新
3. ⏳ `app/api/admin/albums/route.test.ts` - 待更新
4. ⏳ `app/api/admin/albums/[id]/route.test.ts` - 待更新
5. ⏳ `app/api/public/albums/[slug]/route.test.ts` - 待更新
6. ⏳ 其他 API 路由测试文件...

## 相关文档

- [API 迁移指南](./API_MIGRATION_GUIDE.md)
- [环境变量配置](./ENVIRONMENT_VARIABLES.md)
