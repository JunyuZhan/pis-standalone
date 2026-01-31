# API 路由迁移指南

> 从 Supabase 客户端迁移到 PostgreSQL 客户端

## 📋 迁移模式

### 1. 导入语句替换

**替换前：**
```typescript
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
```

**替换后：**
```typescript
import { createClient, createAdminClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
```

### 2. 认证检查替换

**替换前：**
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()

if (!user) {
  return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: '请先登录' } },
    { status: 401 }
  )
}
```

**替换后：**
```typescript
const user = await getCurrentUser(request)

if (!user) {
  return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: '请先登录' } },
    { status: 401 }
  )
}
```

### 3. 数据库查询替换

**替换前：**
```typescript
const supabase = await createClient()
const { data, error, count } = await supabase
  .from('albums')
  .select('*', { count: 'exact' })
  .eq('status', 'active')
  .order('created_at', { ascending: false })
```

**替换后：**
```typescript
const db = await createClient()
const result = await db
  .from('albums')
  .select('*')
  .eq('status', 'active')
  .order('created_at', { ascending: false })

const { data, error, count } = result
```

### 4. 插入操作替换

**替换前：**
```typescript
const { data, error } = await supabase
  .from('albums')
  .insert(insertData)
  .select()
  .single()
```

**替换后：**
```typescript
const result = await db.insert('albums', insertData)
const data = result.data && result.data.length > 0 ? result.data[0] : null
const error = result.error
```

### 5. 更新操作替换

**替换前：**
```typescript
const { data, error } = await supabase
  .from('albums')
  .update({ title: 'New Title' })
  .eq('id', albumId)
  .select()
  .single()
```

**替换后：**
```typescript
const result = await db.update('albums', { title: 'New Title' }, { id: albumId })
const data = result.data && result.data.length > 0 ? result.data[0] : null
const error = result.error
```

### 6. 删除操作替换

**替换前：**
```typescript
const { error } = await supabase
  .from('albums')
  .delete()
  .eq('id', albumId)
```

**替换后：**
```typescript
const result = await db.delete('albums', { id: albumId })
const error = result.error
```

### 7. RPC 调用替换

**替换前：**
```typescript
const { data, error } = await supabase.rpc('function_name', { param: value })
```

**替换后：**
```typescript
const result = await db.rpc('function_name', { param: value })
const { data, error } = result
```

## 📝 注意事项

1. **Count 查询**：PostgreSQL 客户端会自动在有 WHERE 条件时执行计数查询，结果包含在 `count` 字段中
2. **Single 查询**：使用 `.single()` 时，返回 `{ data: T | null }` 而不是 `{ data: T[] }`
3. **错误处理**：错误对象结构相同，但错误代码可能不同（PostgreSQL 使用 SQL 错误代码）
4. **链式调用**：PostgreSQL 客户端支持大部分 Supabase 的链式调用，但某些高级功能可能需要调整

## 🔄 批量替换命令

可以使用以下命令批量替换导入语句：

```bash
# 替换导入语句
find apps/web/src/app/api -name "*.ts" -type f ! -name "*.test.ts" \
  -exec sed -i '' "s|from '@/lib/supabase/server'|from '@/lib/database'|g" {} \;

find apps/web/src/app/api -name "*.ts" -type f ! -name "*.test.ts" \
  -exec sed -i '' "s|from '@/lib/supabase/admin'|from '@/lib/database'|g" {} \;
```

**注意**：批量替换后需要手动检查和修复：
- 认证检查逻辑
- 查询语法差异
- 错误处理

## ✅ 已完成迁移的文件

- ✅ `apps/web/src/app/api/admin/albums/route.ts` - 相册列表 API

## 📋 待迁移文件列表

共 40 个 API 路由文件需要迁移，详见 `grep` 结果。
