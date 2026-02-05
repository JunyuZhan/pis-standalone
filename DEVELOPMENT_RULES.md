# PIS 项目开发规则

> OpenClaw Agent 专用开发规则

## 🎯 核心原则

### 分支管理
- **只允许在 `development` 分支工作**
- **禁止合并到 `main` 分支**，除非同时满足以下条件：
  1. 项目测试功能完整
  2. 测试通过率达到 80%+
  3. 代码运行稳定
  4. 用户明确下达合并任务

### 代码质量
- 修改代码前先运行 `git status` 确认分支
- 每次提交前确保测试通过
- 保持提交信息清晰

## 📋 任务优先级

1. **第一优先级**：修复失败的测试
2. **第二优先级**：提高测试覆盖率（目标 80%+）
3. **第三优先级**：编写集成测试（连接 Docker PostgreSQL 和 Redis）
4. **第四优先级**：功能开发和优化

## 🧪 测试要求

### 单元测试
- 使用 Vitest 框架
- 覆盖率目标：80%+
- Mock 外部依赖（数据库、Redis）

### 集成测试
- 仅在阶段一完成后进行
- 连接 Docker 容器：
  - PostgreSQL: `pis-postgres-dev` (端口 5432)
  - Redis: `pis-redis-dev` (端口 6379)

## ⚠️ 禁止操作

- ❌ 不要合并到 main 分支
- ❌ 不要删除 development 分支
- ❌ 不要修改 main 分支的代码
- ❌ 不要强制推送 `git push --force`

## 📝 工作流程

1. **开始任务前**
   ```
   git status  # 确认在 development 分支
   git pull origin development  # 拉取最新
   ```

2. **完成任务后**
   - 更新 TODO.md 记录进度
   - 提交更改：`git add . && git commit -m "feat: 描述"`
   - **不要推送**，等待用户确认

## 🚀 常用命令

```bash
# 运行测试
pnpm test              # 所有测试
pnpm test:coverage     # 测试 + 覆盖率
pnpm test:watch        # 监听模式

# Docker 服务
docker ps | grep -E "postgres|redis"  # 检查数据库状态

# Git
git checkout development  # 切换到开发分支
```

## 📞 遇到问题

- 测试失败？先分析日志，修复根本原因
- 资源不足？减少测试范围，分批处理
- 不确定操作？先问用户再执行

---

**最后更新**: 2026-02-04
