# 测试脚本

本目录包含所有测试相关的脚本。

## 📋 脚本列表

| 脚本 | 描述 | 用法 |
|------|------|------|
| `run-tests.sh` | 运行所有测试 | `bash scripts/test/run-tests.sh` |
| `comprehensive-test.sh` | 完整测试套件 | `bash scripts/test/comprehensive-test.sh` |
| `test-all.sh` | 运行所有测试脚本 | `bash scripts/test/test-all.sh` |
| `test-api-endpoints.sh` | API 端点测试 | `bash scripts/test/test-api-endpoints.sh` |
| `test-browser-compat.sh` | 浏览器兼容性测试 | `bash scripts/test/test-browser-compat.sh` |
| `test-business-logic.sh` | 业务逻辑测试 | `bash scripts/test/test-business-logic.sh` |
| `test-components.sh` | 组件测试 | `bash scripts/test/test-components.sh` |
| `test-container-communication.sh` | 容器通信测试 | `bash scripts/test/test-container-communication.sh` |
| `test-database-performance.sh` | 数据库性能测试 | `bash scripts/test/test-database-performance.sh` |
| `test-e2e.sh` | E2E 测试 | `bash scripts/test/test-e2e.sh` |
| `test-edge-cases.sh` | 边界情况测试 | `bash scripts/test/test-edge-cases.sh` |
| `test-full-features.sh` | 完整功能测试 | `bash scripts/test/test-full-features.sh` |
| `test-high-concurrency.sh` | 高并发测试 | `bash scripts/test/test-high-concurrency.sh` |
| `test-image-loading-and-cache.sh` | 图片加载和缓存测试 | `bash scripts/test/test-image-loading-and-cache.sh` |
| `test-login-flow.sh` | 登录流程测试 | `bash scripts/test/test-login-flow.sh` |
| `test-mobile.sh` | 移动端测试 | `bash scripts/test/test-mobile.sh` |
| `test-user-experience.sh` | 用户体验测试 | `bash scripts/test/test-user-experience.sh` |
| `test-360.sh` | 360度测试 | `bash scripts/test/test-360.sh` |
| `test-complete.sh` | 完整测试 | `bash scripts/test/test-complete.sh` |

## 🚀 快速开始

### 运行所有测试

```bash
bash scripts/test/run-tests.sh
```

### 运行完整测试套件

```bash
bash scripts/test/comprehensive-test.sh
```

### 运行特定测试

```bash
# API 测试
bash scripts/test/test-api-endpoints.sh

# E2E 测试
bash scripts/test/test-e2e.sh

# 组件测试
bash scripts/test/test-components.sh
```

## 📖 测试文档

更多测试相关信息请参考：
- [测试指南](../../docs/TESTING_GUIDE.md)
- [测试覆盖率分析](../../docs/TEST_COVERAGE_ANALYSIS.md)
