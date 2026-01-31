# 构建问题解决方案指南

> 最后更新: 2026-01-31

## 📋 问题清单

### ✅ 已解决的问题

1. **Worker 服务构建错误** ✅
   - 问题：`PostgresQueryBuilder` 缺少 `update()`, `delete()`, `insert()` 方法
   - 状态：已修复，构建成功

2. **Logger 类型错误** ✅
   - 问题：`pino.Stream[]` 类型错误
   - 状态：已修复

3. **HTTP 模块导入缺失** ✅
   - 问题：`http` 命名空间找不到
   - 状态：已添加导入

### ⚠️ 待解决的问题

1. **Web 应用构建失败 - Google Fonts SSL 问题**
   - 错误：`unable to get local issuer certificate`
   - 原因：网络/SSL 证书问题，无法从 Google Fonts 获取字体
   - 影响：构建失败，但不影响代码质量

---

## 🔧 解决方案

### 方案 1: 使用本地字体文件（推荐）⭐

**优点**：
- 不依赖外部网络
- 构建速度快
- 完全离线可用
- 符合内网部署需求

**步骤**：

1. **下载字体文件到项目**

```bash
# 创建字体目录
mkdir -p apps/web/public/fonts

# 下载字体文件（需要手动下载或使用脚本）
# Inter: https://fonts.google.com/specimen/Inter
# Noto Serif SC: https://fonts.google.com/specimen/Noto+Serif+SC
# Playfair Display: https://fonts.google.com/specimen/Playfair+Display
```

2. **修改 layout.tsx 使用本地字体**

```typescript
// apps/web/src/app/layout.tsx
import localFont from 'next/font/local'

const inter = localFont({
  src: [
    {
      path: '../../public/fonts/Inter-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Inter-SemiBold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Inter-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-inter',
  display: 'swap',
})

const notoSerifSC = localFont({
  src: [
    {
      path: '../../public/fonts/NotoSerifSC-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/NotoSerifSC-SemiBold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../public/fonts/NotoSerifSC-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-noto-serif-sc',
  display: 'swap',
})

const playfairDisplay = localFont({
  src: [
    {
      path: '../../public/fonts/PlayfairDisplay-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/PlayfairDisplay-SemiBold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../public/fonts/PlayfairDisplay-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-playfair-display',
  display: 'swap',
})
```

---

### 方案 2: 配置 Node.js 跳过 SSL 验证（临时方案）⚠️

**注意**：仅用于开发/构建环境，不推荐用于生产环境

**步骤**：

```bash
# 设置环境变量
export NODE_TLS_REJECT_UNAUTHORIZED=0

# 然后构建
cd apps/web
pnpm build
```

**或在 package.json 中配置**：

```json
{
  "scripts": {
    "build": "NODE_TLS_REJECT_UNAUTHORIZED=0 next build"
  }
}
```

---

### 方案 3: 配置代理（适用于企业网络）

**步骤**：

1. **设置代理环境变量**

```bash
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080
export NO_PROXY=localhost,127.0.0.1
```

2. **配置 npm/pnpm 代理**

```bash
pnpm config set proxy http://proxy.example.com:8080
pnpm config set https-proxy http://proxy.example.com:8080
```

---

### 方案 4: 在部署环境中解决（推荐用于生产）

**说明**：
- 构建失败是网络/证书问题，不是代码问题
- 在部署服务器上通常有正常的网络访问
- 可以在 CI/CD 环境中配置代理或使用本地字体

**Docker 构建时**：

```dockerfile
# 在 Dockerfile 中配置代理（如果需要）
ENV HTTP_PROXY=http://proxy:8080
ENV HTTPS_PROXY=http://proxy:8080

# 或使用本地字体（推荐）
COPY fonts/ /app/apps/web/public/fonts/
```

---

## 🎯 推荐方案

**对于内网部署项目**：**使用方案 1（本地字体）**

**原因**：
1. ✅ 完全离线可用
2. ✅ 不依赖外部网络
3. ✅ 构建速度快
4. ✅ 符合内网部署需求
5. ✅ 避免 SSL 证书问题

---

## 📝 实施步骤总结

### 快速修复（临时）

```bash
# 方案 2：跳过 SSL 验证（仅用于构建）
export NODE_TLS_REJECT_UNAUTHORIZED=0
pnpm build
```

### 长期解决方案（推荐）

1. 下载字体文件到 `apps/web/public/fonts/`
2. 修改 `apps/web/src/app/layout.tsx` 使用 `localFont`
3. 移除 Google Fonts 的 preconnect 链接（可选）

---

## ✅ 验证

构建成功后，验证：

```bash
# 构建 Web 应用
cd apps/web
pnpm build

# 应该看到：
# ✓ Compiled successfully
```

---

## 📚 相关文档

- [Next.js Font Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/fonts)
- [Next.js Local Fonts](https://nextjs.org/docs/app/api-reference/components/font#local-fonts)
