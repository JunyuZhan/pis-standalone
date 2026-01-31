# Frpc / DDNSTO 内网穿透配置指南

> 最后更新: 2026-01-31

## 🎯 场景

PIS 部署在内网服务器，使用 **8080 端口**，通过 **frpc** 或 **ddnsto** 实现内网穿透访问。

> **注意**：虽然内网穿透处理了 HTTPS，但**建议保留 Nginx 容器**，因为它负责媒体文件代理（`/media/` → MinIO）和统一入口管理。详见 [Nginx 与内网穿透配合使用分析](./NGINX_WITH_FRPC_ANALYSIS.md)

## ✅ 方案：8080 端口 + 内网穿透

### 架构图

```
Internet
   ↓
[frpc/ddnsto] 内网穿透服务
   ↓
内网服务器:8080 → PIS (Docker)
```

## 📝 配置步骤

### 步骤 1：修改 Docker Compose 端口

```bash
cd docker
vim docker-compose.standalone.yml
```

修改 `nginx` 服务的端口映射：

```yaml
nginx:
  ports:
    - "8080:80"    # HTTP 使用 8080
    # 如果不需要 HTTPS，可以注释掉 443
    # - "8443:443"   # HTTPS 使用 8443（可选）
```

**或者只暴露 HTTP**（推荐，因为内网穿透通常处理 HTTPS）：

```yaml
nginx:
  ports:
    - "8080:80"    # 仅 HTTP
```

### 步骤 2：更新环境变量

```bash
cd ..
vim .env
```

根据你的内网穿透配置更新：

**使用 frpc（假设映射到公网域名 `pis.example.com`）**：
```bash
# 如果 frpc 配置了 HTTPS，使用 https://
NEXT_PUBLIC_APP_URL=https://pis.example.com
NEXT_PUBLIC_MEDIA_URL=https://pis.example.com/media

# 如果 frpc 只配置了 HTTP，使用 http://
# NEXT_PUBLIC_APP_URL=http://pis.example.com:8080
# NEXT_PUBLIC_MEDIA_URL=http://pis.example.com:8080/media
```

**使用 ddnsto（假设映射到 `yourname.ddnsto.com`）**：
```bash
# ddnsto 通常提供 HTTPS
NEXT_PUBLIC_APP_URL=https://yourname.ddnsto.com
NEXT_PUBLIC_MEDIA_URL=https://yourname.ddnsto.com/media
```

### 步骤 3：重启服务

```bash
cd docker
docker compose -f docker-compose.standalone.yml down
docker compose -f docker-compose.standalone.yml up -d
```

### 步骤 4：验证本地访问

```bash
# 检查端口是否监听
sudo netstat -tulpn | grep 8080

# 测试本地访问
curl http://localhost:8080/health
```

---

## 🔧 Frpc 配置示例

### Frpc 客户端配置（frpc.ini）

```ini
[common]
server_addr = your-frps-server.com
server_port = 7000
token = your-token

[pis-web]
type = http
local_ip = 127.0.0.1
local_port = 8080
custom_domains = pis.example.com

# 如果需要 HTTPS
[pis-web-https]
type = https
local_ip = 127.0.0.1
local_port = 8080
custom_domains = pis.example.com
```

### Frpc 启动

```bash
# 使用 systemd（推荐）
sudo systemctl start frpc
sudo systemctl enable frpc

# 或直接运行
./frpc -c frpc.ini
```

### 访问地址

- **HTTP**: `http://pis.example.com`（如果配置了 HTTP）
- **HTTPS**: `https://pis.example.com`（如果配置了 HTTPS）

---

## 🌐 DDNSTO 配置示例

### DDNSTO 设置步骤

1. **登录 DDNSTO 管理界面**
   - 访问：https://www.ddnsto.com

2. **添加设备**
   - 在内网服务器上安装 DDNSTO 客户端
   - 获取设备 Token

3. **配置映射**
   - 类型：HTTP/HTTPS
   - 内网地址：`127.0.0.1:8080`
   - 外网域名：`yourname.ddnsto.com`

4. **启用 HTTPS**（推荐）
   - DDNSTO 自动提供 HTTPS
   - 无需配置 SSL 证书

### 访问地址

- **HTTPS**: `https://yourname.ddnsto.com`（DDNSTO 自动 HTTPS）

---

## 🔒 HTTPS 处理

### 选项 1：内网穿透服务处理 HTTPS（推荐）

**Frpc**：
- 在 frps 服务器配置 SSL 证书
- 客户端配置 `type = https`

**DDNSTO**：
- 自动提供 HTTPS
- 无需额外配置

**优点**：
- ✅ 无需在 PIS 容器内配置 SSL
- ✅ 统一管理证书
- ✅ 简化配置

### 选项 2：PIS 容器内 HTTPS

如果需要容器内 HTTPS，可以同时暴露 8443：

```yaml
nginx:
  ports:
    - "8080:80"
    - "8443:443"   # HTTPS
```

然后在内网穿透中映射 8443 端口。

**注意**：需要配置 SSL 证书到容器内。

---

## 📋 完整配置示例

### Docker Compose（推荐配置）

```yaml
nginx:
  image: nginx:alpine
  container_name: pis-nginx
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./nginx/conf.d:/etc/nginx/conf.d:ro
    - pis_nginx_logs:/var/log/nginx
  ports:
    - "8080:80"    # HTTP，HTTPS 由内网穿透处理
    # 注意：保留 Nginx 容器用于媒体文件代理和统一入口管理
  depends_on:
    - web
    - minio
    - worker
  restart: unless-stopped
  networks:
    - pis-network
```

> **为什么保留 Nginx？**
> - ✅ 媒体文件代理：`/media/` → MinIO（自动处理）
> - ✅ 统一入口：所有请求通过 Nginx
> - ✅ CORS 和缓存：自动支持
> - ✅ 资源占用小：仅 10-20MB
> 
> 详见：[Nginx 与内网穿透配合使用分析](./NGINX_WITH_FRPC_ANALYSIS.md)

### 环境变量（.env）

```bash
# 应用公网访问地址（通过内网穿透）
NEXT_PUBLIC_APP_URL=https://pis.example.com
NEXT_PUBLIC_MEDIA_URL=https://pis.example.com/media

# Worker API（内网穿透地址）
NEXT_PUBLIC_WORKER_URL=https://pis.example.com/api/worker

# 其他配置保持不变
DATABASE_TYPE=postgresql
# ...
```

---

## 🔍 验证清单

### 本地验证

- [ ] 端口 8080 已监听
- [ ] `curl http://localhost:8080/health` 返回成功
- [ ] Docker 容器正常运行

### 内网穿透验证

- [ ] Frpc/DDNSTO 客户端已连接
- [ ] 映射配置正确（内网地址：127.0.0.1:8080）
- [ ] 公网域名可以访问
- [ ] `curl https://your-domain.com/health` 返回成功

### 应用验证

- [ ] 浏览器可以访问应用首页
- [ ] 媒体文件可以正常加载
- [ ] API 请求正常
- [ ] 登录功能正常

---

## 🐛 常见问题

### Q: 内网穿透访问很慢？

**可能原因**：
- 内网穿透服务器带宽限制
- 网络延迟

**解决方案**：
- 选择更近的内网穿透服务器
- 使用付费服务获得更好带宽
- 考虑使用云服务器直接部署

### Q: HTTPS 证书问题？

**Frpc**：
- 在 frps 服务器配置 SSL 证书
- 或使用 Let's Encrypt 自动证书

**DDNSTO**：
- DDNSTO 自动提供 HTTPS，无需配置

### Q: 如何同时支持 HTTP 和 HTTPS？

**Frpc**：
```ini
# HTTP
[pis-web-http]
type = http
local_ip = 127.0.0.1
local_port = 8080
custom_domains = pis.example.com

# HTTPS
[pis-web-https]
type = https
local_ip = 127.0.0.1
local_port = 8080
custom_domains = pis.example.com
```

**DDNSTO**：
- 只配置一个 HTTPS 映射即可
- HTTP 会自动重定向到 HTTPS

### Q: 端口冲突？

如果 8080 也被占用，可以改用其他端口：

```yaml
nginx:
  ports:
    - "8081:80"    # 使用 8081
```

然后在内网穿透中映射 8081。

---

## 📊 端口映射总结

| 服务 | 内网端口 | 内网穿透映射 | 公网访问 |
|------|---------|------------|---------|
| PIS Web | 8080 | 127.0.0.1:8080 | https://your-domain.com |
| MinIO | 9000 | （可选）127.0.0.1:9000 | （通常不需要） |
| PostgreSQL | 5432 | （不推荐） | （不推荐暴露） |
| Redis | 6379 | （不推荐） | （不推荐暴露） |

**建议**：只映射 PIS Web（8080），其他服务保持内部访问。

---

## 🚀 快速部署命令

```bash
# 1. 修改端口
cd docker
sed -i 's/"80:80"/"8080:80"/' docker-compose.standalone.yml

# 2. 更新环境变量（需要手动编辑域名）
cd ..
vim .env
# NEXT_PUBLIC_APP_URL=https://your-domain.com

# 3. 重启服务
cd docker
docker compose -f docker-compose.standalone.yml up -d

# 4. 验证
curl http://localhost:8080/health
```

---

## 📚 相关文档

- [端口冲突解决方案](./PORT_CONFLICT_SOLUTIONS.md)
- [快速端口修复](./QUICK_PORT_FIX.md)
- [Docker 网络和端口配置](./DOCKER_NETWORK_AND_PORTS.md)
