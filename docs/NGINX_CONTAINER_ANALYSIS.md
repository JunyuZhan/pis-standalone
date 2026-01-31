# Nginx 容器必要性分析

> 最后更新: 2026-01-31

## ❓ 问题：Nginx 是否必须单独一个容器？

**简短回答**：**不是必须的**，但**强烈推荐**单独容器。

## 📋 Nginx 的作用

在 Standalone 模式中，`pis-nginx` 容器负责：

1. **SSL/TLS 终止** - 处理 HTTPS（443 端口）
2. **反向代理** - 统一入口，代理到：
   - `pis-web:3000` - Next.js Web 前端
   - `pis-minio:9000` - MinIO 对象存储
   - `pis-worker:3001` - Worker API
3. **HTTP 重定向** - 将 HTTP（80）重定向到 HTTPS（443）
4. **安全头设置** - X-Frame-Options, CSP 等
5. **日志记录** - 访问日志和错误日志
6. **Let's Encrypt 支持** - ACME 挑战路径

## 🔄 替代方案

### 方案 1：主机上的 Nginx（推荐用于生产）

**优点**：
- ✅ 不占用容器资源
- ✅ 更容易管理 SSL 证书（直接挂载到主机）
- ✅ 性能更好（无容器开销）
- ✅ 可以使用系统包管理器更新

**缺点**：
- ❌ 需要手动配置
- ❌ 需要主机有 nginx 安装

**配置示例**：
```nginx
# /etc/nginx/sites-available/pis
upstream pis_web {
    server 127.0.0.1:3000;  # 直接暴露 web 容器端口
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://pis_web;
        # ... 其他配置
    }
}
```

**Docker Compose 修改**：
```yaml
web:
  ports:
    - "127.0.0.1:3000:3000"  # 仅本地访问，由主机 nginx 代理
  # 移除 nginx 容器
```

### 方案 2：在 Web 容器中集成 Nginx（不推荐）

**优点**：
- ✅ 减少一个容器

**缺点**：
- ❌ 违反单一职责原则
- ❌ 容器内需要运行两个进程（Next.js + Nginx）
- ❌ 需要 init 系统（如 supervisord）
- ❌ 更新和维护复杂
- ❌ 资源隔离困难

### 方案 3：直接暴露 Web 容器端口（仅开发环境）

**优点**：
- ✅ 最简单

**缺点**：
- ❌ 无 SSL/TLS 支持
- ❌ 无统一入口
- ❌ 无法代理 MinIO 和 Worker
- ❌ 不安全

**配置示例**：
```yaml
web:
  ports:
    - "80:3000"  # 直接暴露，无 SSL
```

## ✅ 推荐方案对比

| 方案 | 适用场景 | 容器数 | 复杂度 | 推荐度 |
|------|---------|--------|--------|--------|
| **单独 Nginx 容器** | Docker 完全部署 | 7 个 | 低 | ⭐⭐⭐⭐⭐ |
| **主机 Nginx** | 生产环境，已有 Nginx | 6 个 | 中 | ⭐⭐⭐⭐ |
| **集成 Nginx** | 特殊需求 | 6 个 | 高 | ⭐⭐ |
| **直接暴露** | 仅开发/测试 | 6 个 | 低 | ⭐ |

## 🎯 结论

### 什么时候可以不用单独的 Nginx 容器？

1. **使用主机上的 Nginx**
   - 生产环境已有 Nginx
   - 需要更好的性能
   - 更容易管理 SSL 证书

2. **开发/测试环境**
   - 不需要 SSL
   - 直接访问 `http://localhost:3000`

3. **使用云服务商的负载均衡器**
   - AWS ALB/NLB
   - 阿里云 SLB
   - 腾讯云 CLB
   - 这些服务已经提供 SSL 终止和反向代理

### 什么时候需要单独的 Nginx 容器？

1. **完全 Docker 化部署**
   - 所有服务都在容器中
   - 希望一键部署，无需主机配置

2. **快速原型/演示**
   - 需要快速启动完整环境
   - 不需要优化性能

3. **CI/CD 环境**
   - 自动化部署
   - 容器化测试环境

## 📝 如何移除 Nginx 容器

### 步骤 1：修改 docker-compose.standalone.yml

```yaml
# 注释掉或删除 nginx 服务
# nginx:
#   image: nginx:alpine
#   ...

# 修改 web 服务端口映射
web:
  ports:
    - "127.0.0.1:3000:3000"  # 仅本地，由主机 nginx 代理
```

### 步骤 2：配置主机 Nginx

```bash
# 复制配置到主机
sudo cp docker/nginx/conf.d/default.conf /etc/nginx/sites-available/pis
sudo ln -s /etc/nginx/sites-available/pis /etc/nginx/sites-enabled/

# 修改配置中的上游地址
# upstream pis_web {
#     server 127.0.0.1:3000;  # 改为本地端口
# }

# 测试并重载
sudo nginx -t
sudo systemctl reload nginx
```

### 步骤 3：更新存储卷

```yaml
volumes:
  # 移除 nginx 相关卷
  # pis_nginx_logs:
  #   name: pis_nginx_logs
```

## 🔧 当前配置说明

**Standalone 模式使用单独的 Nginx 容器**，原因：

1. ✅ **一键部署** - 无需主机配置
2. ✅ **完全容器化** - 所有服务都在 Docker 中
3. ✅ **SSL 支持** - 内置 SSL/TLS 配置
4. ✅ **统一入口** - 80/443 端口统一管理
5. ✅ **易于维护** - 配置文件和日志都在容器中

## 📊 资源占用

Nginx 容器资源占用很小：
- **内存**: ~10-20 MB
- **CPU**: 几乎为 0（静态代理）
- **磁盘**: ~5 MB（Alpine 镜像）

对于大多数部署场景，这个开销是可以接受的。

## 🎯 总结

- ❌ **不是必须的** - 可以用主机 Nginx 或云负载均衡器替代
- ✅ **强烈推荐** - 对于完全 Docker 化部署，单独容器更简单
- 🔄 **可替换** - 可以根据实际需求选择不同方案

**建议**：
- **开发/测试**: 直接暴露端口，不用 Nginx
- **Docker 完全部署**: 使用单独的 Nginx 容器（当前方案）
- **生产环境（已有 Nginx）**: 使用主机 Nginx，移除容器
