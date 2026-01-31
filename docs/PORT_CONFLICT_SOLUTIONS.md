# 端口冲突解决方案

> 最后更新: 2026-01-31

## ❓ 问题：服务器上其他应用占用了 80/443 端口

当服务器上已有其他应用（如其他网站、API 服务等）占用了 80 和 443 端口时，PIS 的 Nginx 容器无法启动。

## 🔍 检查端口占用

### 检查 80/443 端口占用

```bash
# 检查 80 端口
sudo lsof -i :80
sudo netstat -tulpn | grep :80
sudo ss -tulpn | grep :80

# 检查 443 端口
sudo lsof -i :443
sudo netstat -tulpn | grep :443
sudo ss -tulpn | grep :443
```

### 查看占用端口的进程

```bash
# 查看占用 80 端口的进程
sudo fuser 80/tcp

# 查看占用 443 端口的进程
sudo fuser 443/tcp
```

## ✅ 解决方案

> **提示**：如果使用 **frpc** 或 **ddnsto** 内网穿透，推荐使用 **方案 1（8080 端口）**。详见 [Frpc/DDNSTO 配置指南](./FRPC_DDNSTO_SETUP.md)

### 方案 1：使用不同端口（最简单）

**适用场景**：
- 快速部署
- 测试环境
- 不需要标准 HTTP/HTTPS 端口

**步骤**：

#### 1.1 修改 docker-compose.standalone.yml

```yaml
nginx:
  ports:
    - "8080:80"    # HTTP 改为 8080
    - "8443:443"   # HTTPS 改为 8443
```

#### 1.2 更新环境变量

```bash
# .env 文件
NEXT_PUBLIC_APP_URL=https://yourdomain.com:8443
NEXT_PUBLIC_MEDIA_URL=https://yourdomain.com:8443/media
```

#### 1.3 访问方式

```
HTTP:  http://yourdomain.com:8080
HTTPS: https://yourdomain.com:8443
```

**优点**：
- ✅ 简单快速
- ✅ 无需修改主机配置
- ✅ 不影响其他应用

**缺点**：
- ❌ URL 需要带端口号
- ❌ 用户体验不佳
- ❌ 某些防火墙可能阻止非标准端口

---

### 方案 2：使用主机 Nginx 作为统一入口（推荐）

**适用场景**：
- 生产环境
- 已有主机 Nginx
- 需要统一管理多个应用

**架构**：
```
Internet
   ↓
[80/443] 主机 Nginx (统一入口)
   ├──→ /app1 → 应用1 (端口 8001)
   ├──→ /app2 → 应用2 (端口 8002)
   └──→ /      → PIS (端口 8080/8443)
```

#### 2.1 修改 PIS 端口

```yaml
# docker-compose.standalone.yml
nginx:
  ports:
    - "127.0.0.1:8080:80"    # 仅本地访问
    - "127.0.0.1:8443:443"   # 仅本地访问
```

或者**完全移除 Nginx 容器**，直接暴露 Web 容器：

```yaml
# docker-compose.standalone.yml
web:
  ports:
    - "127.0.0.1:3000:3000"  # 仅本地访问

# 移除 nginx 服务
# nginx: ...
```

#### 2.2 配置主机 Nginx

**选项 A：子路径部署**（如 `/pis`）

```nginx
# /etc/nginx/sites-available/pis
server {
    listen 80;
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # 其他应用
    location /app1 {
        proxy_pass http://127.0.0.1:8001;
        # ...
    }
    
    # PIS 应用（子路径）
    location /pis {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 重写路径（如果需要）
        rewrite ^/pis(.*)$ $1 break;
    }
    
    # PIS 媒体文件
    location /media {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**选项 B：子域名部署**（如 `pis.yourdomain.com`）

```nginx
# /etc/nginx/sites-available/pis
server {
    listen 80;
    listen 443 ssl http2;
    server_name pis.yourdomain.com;  # 子域名
    
    ssl_certificate /etc/letsencrypt/live/pis.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pis.yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /media {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**选项 C：主域名部署**（如 `yourdomain.com`）

```nginx
# /etc/nginx/sites-available/pis
server {
    listen 80;
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # 主站点直接代理到 PIS
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 其他应用（如果存在）
    location /api {
        proxy_pass http://127.0.0.1:8001;
        # ...
    }
}
```

#### 2.3 启用配置

```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/pis /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

**优点**：
- ✅ 统一管理多个应用
- ✅ 标准端口（80/443）
- ✅ 更好的 SSL 证书管理
- ✅ 专业的生产环境方案

**缺点**：
- ⚠️ 需要配置主机 Nginx
- ⚠️ 需要域名和 SSL 证书

---

### 方案 3：使用云负载均衡器

**适用场景**：
- 云服务器（AWS、阿里云、腾讯云等）
- 需要高可用性
- 多个服务器实例

**架构**：
```
Internet
   ↓
[80/443] 云负载均衡器 (ALB/SLB/CLB)
   ↓
服务器1: PIS (端口 8080)
服务器2: 其他应用 (端口 8001)
```

#### 3.1 配置示例（阿里云 SLB）

```yaml
# docker-compose.standalone.yml
nginx:
  ports:
    - "127.0.0.1:8080:80"    # 仅本地
    - "127.0.0.1:8443:443"   # 仅本地
```

#### 3.2 负载均衡器配置

- **监听器**: 80/443
- **后端服务器**: 服务器内网 IP:8080
- **健康检查**: `http://内网IP:8080/health`

**优点**：
- ✅ 高可用性
- ✅ 自动故障转移
- ✅ 标准端口
- ✅ 无需配置主机 Nginx

**缺点**：
- ❌ 需要云服务商支持
- ❌ 可能有额外费用

---

### ~~方案 4：修改其他应用的端口~~ ❌ 不推荐

**注意**：此方案通常不可行，因为：
- ❌ 其他应用可能无法修改
- ❌ 修改可能影响其他应用的用户
- ❌ 需要协调多个应用

**建议**：使用方案 1 或方案 2

---

## 📊 方案对比

| 方案 | 复杂度 | 端口 | 用户体验 | 推荐度 | 可行性 |
|------|--------|------|---------|--------|--------|
| **方案 1：不同端口** | ⭐ | 8080/8443 | ⭐⭐ | ⭐⭐⭐⭐ | ✅ 高 |
| **方案 2：主机 Nginx** | ⭐⭐⭐ | 80/443 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ 高 |
| **方案 3：云负载均衡** | ⭐⭐ | 80/443 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⚠️ 需云服务 |
| ~~方案 4：修改其他应用~~ | - | - | - | ❌ | ❌ 通常不可行 |

## 🎯 推荐方案

> **注意**：如果其他应用已占用 80/443 端口且无法修改，推荐以下方案：

### 🚀 快速部署（推荐）
→ **方案 1：使用不同端口（8080/8443）**
- ✅ 最简单快速
- ✅ 无需修改主机配置
- ✅ 5 分钟完成

### 🏆 生产环境最佳实践（强烈推荐）
→ **方案 2：使用主机 Nginx 作为统一入口**
- ✅ 标准端口（80/443）
- ✅ 统一管理多个应用
- ✅ 专业的生产环境方案

### ☁️ 云服务器环境
→ **方案 3：使用云负载均衡器**
- ✅ 高可用性
- ✅ 自动故障转移
- ⚠️ 需要云服务商支持

## 🔧 快速实施指南

### 快速方案（方案 1）

```bash
# 1. 修改 docker-compose.standalone.yml
cd docker
vim docker-compose.standalone.yml

# 修改 nginx 端口
# ports:
#   - "8080:80"
#   - "8443:443"

# 2. 更新环境变量
vim ../.env
# NEXT_PUBLIC_APP_URL=https://yourdomain.com:8443

# 3. 重启服务
docker compose -f docker-compose.standalone.yml up -d
```

### 生产方案（方案 2）

```bash
# 1. 修改 PIS 端口为仅本地
cd docker
vim docker-compose.standalone.yml
# nginx:
#   ports:
#     - "127.0.0.1:8080:80"
#     - "127.0.0.1:8443:443"

# 2. 配置主机 Nginx
sudo cp docker/nginx/conf.d/default.conf /etc/nginx/sites-available/pis
sudo vim /etc/nginx/sites-available/pis
# 修改 proxy_pass 为 http://127.0.0.1:8080

# 3. 启用配置
sudo ln -s /etc/nginx/sites-available/pis /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 4. 重启 PIS
docker compose -f docker-compose.standalone.yml up -d
```

## 📝 注意事项

1. **防火墙规则**
   - 确保新端口在防火墙中开放
   - 如果使用云服务器，检查安全组规则

2. **SSL 证书**
   - 如果使用非标准端口，SSL 证书配置可能需要调整
   - 使用主机 Nginx 时，证书在主机上管理更方便

3. **环境变量**
   - 修改端口后，记得更新 `.env` 中的 URL 配置
   - 特别是 `NEXT_PUBLIC_APP_URL` 和 `NEXT_PUBLIC_MEDIA_URL`

4. **健康检查**
   - 确保健康检查端点使用正确的端口
   - `/health` 端点应该能正常访问

## 🔍 验证

```bash
# 检查新端口是否监听
sudo netstat -tulpn | grep 8080
sudo netstat -tulpn | grep 8443

# 测试访问
curl http://localhost:8080/health
curl -k https://localhost:8443/health

# 检查容器状态
docker ps | grep pis-nginx
docker logs pis-nginx
```

## 📚 相关文档

- [Docker 网络和端口配置](./DOCKER_NETWORK_AND_PORTS.md)
- [Nginx 容器分析](./NGINX_CONTAINER_ANALYSIS.md)
- [部署检查清单](./DEPLOYMENT_CHECKLIST.md)
