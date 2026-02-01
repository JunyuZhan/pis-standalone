# PIS 测试指南

> 最后更新: 2026-01-31

## 📋 概述

PIS 项目提供了全面的测试套件，涵盖：
- ✅ API 端点测试
- ✅ 业务逻辑测试
- ✅ 前端组件测试（53个测试用例）
- ✅ E2E 测试（5个测试文件）
- ✅ 移动端测试（多设备支持）
- ✅ 边界情况测试（新增）
- ✅ 浏览器兼容性测试（新增）
- ✅ 性能测试
- ✅ 安全测试

## 🚀 快速开始

### 一键运行所有测试

```bash
# 运行完整测试套件（推荐）
bash scripts/test-all.sh
```

这将运行所有测试并生成详细报告。

### 分步骤运行测试

```bash
# 1. 综合测试（环境、容器、代码质量、单元测试、安全）
bash scripts/comprehensive-test.sh

# 2. API 端点测试
bash scripts/test-api-endpoints.sh

# 3. 登录流程测试
bash scripts/test-login-flow.sh

# 4. 前端组件测试（新增）
pnpm test:components

# 5. E2E 测试（新增，需要服务运行）
pnpm test:e2e

# 6. 移动端测试（新增）
pnpm test:mobile

# 7. 分步骤测试（生成详细报告）
bash scripts/run-tests.sh
```

## 📊 测试脚本说明

### 新增测试脚本

#### 组件测试
- **`scripts/test-components.sh`** - 前端组件测试
  - 运行所有 React 组件单元测试
  - 使用 Vitest + Testing Library

#### E2E 测试
- **`scripts/test-e2e.sh`** - E2E 测试
  - 运行 Playwright E2E 测试
  - 支持多浏览器和移动端

#### 移动端测试
- **`scripts/test-mobile.sh`** - 移动端测试
  - 运行移动设备模拟测试
  - 测试响应式布局和触摸交互

#### 边界情况测试
- **`scripts/test-edge-cases.sh`** - 边界情况测试
  - 测试超长文本、特殊字符、数值边界
  - 测试并发请求、无效输入、编码处理

#### 浏览器兼容性测试
- **`scripts/test-browser-compat.sh`** - 浏览器兼容性测试
  - 运行跨浏览器测试（Chrome, Firefox, Safari）
  - 验证关键功能在不同浏览器中的表现

---

## 📊 原有测试脚本说明

### 1. `scripts/test-all.sh`
**一键运行所有测试**

- ✅ 环境检查
- ✅ 容器状态检查
- ✅ API 端点测试
- ✅ 登录流程测试
- ✅ 数据库功能测试
- ✅ Redis 功能测试
- ✅ MinIO 功能测试
- ✅ Worker 服务测试
- ✅ 资源使用情况

**输出**: 生成时间戳报告文件到 `/tmp/pis-complete-test-report-*.txt`

### 2. `scripts/comprehensive-test.sh`
**综合测试脚本**

**参数**:
- `--skip-build`: 跳过代码质量检查（TypeScript、ESLint）
- `--skip-stress`: 跳过压力测试
- `--skip-security`: 跳过安全检查

**测试内容**:
- 环境检查（Docker、Node.js、pnpm）
- 容器状态和健康检查
- 代码质量测试（可选）
- 单元测试和集成测试
- API 业务逻辑测试
- 数据库连接测试
- 压力测试（可选）
- 安全测试（可选）

**示例**:
```bash
# 运行所有测试
bash scripts/comprehensive-test.sh

# 跳过构建相关测试（更快）
bash scripts/comprehensive-test.sh --skip-build

# 仅运行核心功能测试
bash scripts/comprehensive-test.sh --skip-build --skip-stress --skip-security
```

### 3. `scripts/test-api-endpoints.sh`
**API 端点详细测试**

测试所有 API 端点的功能和响应：
- ✅ 健康检查端点
- ✅ 认证相关端点
- ✅ 公开相册端点
- ✅ 代理端点（MinIO、Media、Worker）
- ✅ 管理端点（需要认证）

### 4. `scripts/test-login-flow.sh`
**登录流程完整测试**

测试登录相关的所有功能：
- ✅ 管理员状态检查
- ✅ 登录页面可访问性
- ✅ 登录 API 验证（空数据、无效格式、缺少字段）
- ✅ 用户名登录支持（admin）
- ✅ SQL 注入防护
- ✅ XSS 防护
- ✅ CORS 配置
- ✅ 速率限制检查

### 5. `scripts/run-tests.sh`
**分步骤测试（生成详细报告）**

逐步运行各个测试类别，生成时间戳报告文件。

**报告位置**: `/tmp/pis-test-report-YYYYMMDD-HHMMSS.txt`

### 6. `scripts/check-security.sh`
**安全检查脚本**

检查：
- ✅ 敏感文件是否被 Git 跟踪
- ✅ Git 历史中是否有敏感文件
- ✅ 硬编码的 JWT tokens
- ✅ 硬编码的 Supabase URL
- ✅ AWS Access Keys
- ✅ 硬编码的密码
- ✅ `.env.example` 文件检查
- ✅ `.gitignore` 配置

## 📈 测试结果解读

### 测试状态

- ✅ **通过**: 测试成功
- ⚠️ **警告**: 测试通过但有警告（不影响功能）
- ❌ **失败**: 测试失败

### 性能指标

#### API 响应时间
- 健康检查: ~40-77ms (P95: 72ms)
- 管理员状态: ~40-50ms
- 登录端点: ~50-100ms

#### 并发性能
- 10 并发: ✅ 稳定
- 请求速率: 222+ 请求/秒
- 错误率: 0%

### 资源使用

典型资源使用情况（参考）：
- **Web 容器**: ~76MB 内存，3-4% CPU
- **Worker 容器**: ~38MB 内存，<1% CPU
- **PostgreSQL**: ~29MB 内存，<1% CPU
- **Redis**: ~15MB 内存，<1% CPU
- **MinIO**: ~308MB 内存，<1% CPU

## 🔍 测试覆盖范围

### 业务逻辑测试 ✅
- [x] API 端点功能
- [x] 登录流程
- [x] 管理员状态检查
- [x] 错误处理

### 代码质量测试 ⚠️
- [x] ESLint 检查（有少量警告）
- [x] TypeScript 类型检查（有少量错误）
- [ ] 代码覆盖率（目标: 80%+）

### 压力测试 ✅
- [x] Apache Bench 测试
- [x] 并发请求测试
- [ ] 长时间运行测试

### 安全测试 ✅
- [x] SQL 注入防护
- [x] XSS 防护
- [x] 路径遍历防护
- [x] CORS 配置
- [x] 敏感信息检查

## 🐛 常见问题

### 1. 测试失败：容器未运行

**解决方案**:
```bash
# 启动所有容器
docker compose -f docker/docker-compose.standalone.yml up -d

# 等待容器健康
docker compose -f docker/docker-compose.standalone.yml ps
```

### 2. 测试失败：端口被占用

**解决方案**:
```bash
# 检查端口占用
lsof -i :8081

# 停止占用端口的进程或修改端口配置
```

### 3. 测试失败：数据库连接错误

**解决方案**:
```bash
# 检查 PostgreSQL 容器状态
docker exec pis-postgres psql -U pis -d pis -c "SELECT 1;"

# 检查环境变量
docker exec pis-postgres env | grep POSTGRES
```

### 4. 单元测试失败

**解决方案**:
```bash
# 查看详细错误
cd /Users/apple/Documents/Project/PIS/pis-standalone
pnpm test

# 运行特定测试
pnpm test -- src/lib/auth/database.test.ts
```

## 📝 CI/CD 集成

### GitHub Actions 示例

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 9.0.0
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: docker compose -f docker/docker-compose.standalone.yml up -d
      - run: bash scripts/test-all.sh
      - run: docker compose -f docker/docker-compose.standalone.yml down
```

## 🎯 最佳实践

1. **定期运行测试**: 在提交代码前运行 `bash scripts/test-all.sh`
2. **查看报告**: 检查生成的测试报告文件
3. **修复失败**: 优先修复失败的测试
4. **提高覆盖率**: 为新功能添加测试
5. **性能监控**: 定期运行压力测试，监控性能变化

## 📚 相关文档

- [测试报告](./TEST_REPORT.md) - 详细的测试结果和性能指标
- [开发指南](./DEVELOPMENT.md) - 开发环境设置和测试说明
- [安全文档](./SECURITY.md) - 安全最佳实践

---

**测试工具**: Vitest, Apache Bench, curl, Docker CLI  
**测试环境**: Docker Compose (Standalone 模式)  
**报告位置**: `/tmp/pis-*-test-report-*.txt`
