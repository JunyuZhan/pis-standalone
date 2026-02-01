# 内网服务器一键部署检查清单

> 最后更新: 2026-01-31

## ✅ 当前状态

### 代码准备状态

- ✅ **Worker 服务**: 构建成功，所有类型错误已修复
- ✅ **Web 应用代码**: 已修改为使用本地字体
- ⚠️ **字体文件**: 目录已创建，但字体文件尚未下载

### 部署脚本

- ✅ `docker/deploy.sh` - 引导式部署脚本（推荐）
- ✅ `scripts/deploy.sh` - 一键部署脚本

---

## 🚀 一键部署方案

### 方案 A: 在服务器上部署（推荐）⭐

**优点**：
- 服务器通常有正常网络访问
- 可以在服务器上下载字体文件
- 或使用系统字体临时方案

**步骤**：

```bash
# 1. SSH 登录到内网服务器
ssh user@your-server-ip

# 2. 克隆代码（或上传代码）
git clone <your-repo-url> pis-standalone
cd pis-standalone

# 3. 运行部署脚本
bash docker/deploy.sh
```

**如果构建时字体文件缺失**：

部署脚本构建时会失败。有两个选择：

1. **在服务器上下载字体文件**（推荐）：
   ```bash
   # 在服务器上（如果有网络访问）
   bash scripts/setup-fonts.sh
   # 或手动下载（见 docs/FONTS.md）
   ```

2. **使用系统字体临时方案**：
   ```bash
   # 修改 layout.tsx 使用系统字体（见 docs/FONTS.md）
   ```

---

### 方案 B: 本地准备后部署

**步骤**：

1. **在本地准备字体文件**：
   ```bash
   # 下载字体文件
   bash scripts/setup-fonts.sh
   # 或手动下载（见 docs/FONTS.md）
   ```

2. **提交代码和字体文件**：
   ```bash
   git add apps/web/public/fonts/*.woff2
   git commit -m "Add local font files for deployment"
   git push
   ```

3. **在服务器上部署**：
   ```bash
   ssh user@your-server-ip
   git clone <your-repo-url> pis-standalone
   cd pis-standalone
   bash docker/deploy.sh
   ```

---

### 方案 C: Docker 构建时处理

如果使用 Docker 构建，可以在 Dockerfile 中处理字体：

**选项 1**: 在构建时下载（需要网络）
```dockerfile
# 在 Dockerfile 中添加
RUN bash scripts/setup-fonts.sh || echo "Font download failed, using fallback"
```

**选项 2**: 使用系统字体（无需下载）
修改 `layout.tsx` 使用系统字体回退。

---

## 📋 部署前检查清单

### 必需项

- [ ] **服务器要求**：
  - [ ] Ubuntu 20.04+ / Debian 11+ / CentOS 7+
  - [ ] 2 核 2GB 内存（独立模式）或 1 核 1GB（混合模式）
  - [ ] Docker 和 Docker Compose 已安装（脚本会自动安装）

- [ ] **网络要求**：
  - [ ] 服务器可以访问 Docker Hub（拉取镜像）
  - [ ] 端口 8080 可用（PIS 使用 8080 端口，配合 frpc/ddnsto 内网穿透）✅ **已配置**
  - [ ] 内网穿透服务已准备（frpc 或 ddnsto）

- [ ] **字体文件**（选择一个）：
  - [ ] 选项 A: 已下载字体文件到 `apps/web/public/fonts/`
  - [ ] 选项 B: 服务器有网络可以下载字体
  - [ ] 选项 C: 使用系统字体方案（修改 layout.tsx）

### 可选项

- [ ] SSL 证书配置（Let's Encrypt）
- [ ] 域名配置
- [ ] 防火墙规则
- [ ] 备份策略

---

## 🔧 快速修复（如果构建失败）

### 问题：字体文件缺失导致构建失败

**解决方案 1**: 在服务器上下载字体

```bash
# 在服务器上
cd pis-standalone
bash scripts/setup-fonts.sh
# 或手动下载（见 [字体配置指南](./FONTS.md)）
```

**解决方案 2**: 使用系统字体（最快）

修改 `apps/web/src/app/layout.tsx`，使用系统字体替代本地字体文件。

详细步骤见：[字体配置指南](./FONTS.md)

---

## 📝 部署命令

### 完全独立模式（推荐）

```bash
# 在服务器上
git clone <your-repo-url> pis-standalone
cd pis-standalone
bash docker/deploy.sh
```

### 远程部署

```bash
# 在本地机器
git clone <your-repo-url> pis-standalone
cd pis-standalone
bash docker/deploy.sh <服务器IP> <SSH用户>
# 示例: bash docker/deploy.sh 192.168.1.100 root
```

---

## ✅ 部署后验证

1. **检查服务状态**：
   ```bash
   docker-compose ps
   ```

2. **检查日志**：
   ```bash
   docker-compose logs -f
   ```

3. **访问应用**：
   - 本地访问: http://your-server-ip:8080
   - 通过内网穿透: https://your-domain.com（frpc/ddnsto）
   - 如果使用主机 Nginx: https://your-domain.com（标准端口）

4. **健康检查**：
   ```bash
   # 本地检查
   curl http://localhost:8080/health
   
   # 公网检查（通过内网穿透）
   curl https://your-domain.com/health
   ```

---

## 🎯 推荐流程

**对于内网服务器部署**：

1. ✅ **代码已准备好**（Worker 构建成功，Web 代码已修改）
2. ⚠️ **字体文件需要处理**（选择一个方案）：
   - 在服务器上下载（如果有网络）
   - 本地准备后上传
   - 使用系统字体（最快）
3. 🚀 **运行部署脚本**：
   ```bash
   bash docker/deploy.sh
   ```

---

## 📚 相关文档

- `docs/i18n/zh-CN/DEPLOYMENT.md` - 完整部署文档
- [字体配置指南](./FONTS.md) - 字体文件下载和配置
- `docker/deploy.sh` - 部署脚本

---

## ⚠️ 注意事项

1. **端口配置**：PIS 默认使用 8080 端口，配合 frpc/ddnsto 内网穿透使用
2. **字体文件大小**：9 个字体文件约 2-5MB，建议添加到 Git 或单独处理
3. **网络依赖**：如果服务器完全离线，需要提前准备所有资源
4. **构建时间**：首次构建可能需要 10-20 分钟（下载镜像和构建）
5. **存储空间**：确保服务器有足够空间（至少 5GB）
6. **内网穿透**：如果使用 frpc/ddnsto，需要配置内网地址为 `127.0.0.1:8080`

---

## 🆘 遇到问题？

1. 检查日志：`docker-compose logs -f`
2. 查看文档：`docs/i18n/zh-CN/DEPLOYMENT.md`
3. 检查字体：确保字体文件存在或使用系统字体方案
