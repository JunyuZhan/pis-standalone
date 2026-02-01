# SSL 证书问题修复指南

## 问题描述

在 macOS 开发环境中，可能会遇到以下错误：

```
Error: unable to get local issuer certificate (UNABLE_TO_GET_ISSUER_CERT_LOCALLY)
```

这会导致：
- Google Fonts 下载失败
- Supabase API 调用失败
- 所有 HTTPS 请求失败

## 快速修复

### 方法 1: 永久修复（推荐用于开发环境）

将以下内容添加到 `~/.zshrc` 或 `~/.bash_profile`：

```bash
# 修复 Node.js SSL 证书问题（macOS）
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

然后重新加载 shell：

```bash
source ~/.zshrc  # 或 source ~/.bash_profile
```

**注意**: `NODE_TLS_REJECT_UNAUTHORIZED=0` 会禁用 SSL 验证，仅适用于开发环境。生产环境请使用正确的证书配置。

### 方法 2: 使用系统证书（更安全）

如果系统有正确的 CA 证书，可以设置：

```bash
# macOS 系统证书
export NODE_EXTRA_CA_CERTS="/etc/ssl/cert.pem"

# 或 Homebrew 证书
export NODE_EXTRA_CA_CERTS="$(brew --prefix)/etc/ca-certificates/cert.pem"
```

## 常见场景

### 公司网络/代理环境

如果你的网络使用代理或公司防火墙，可能需要：

1. 获取公司 CA 证书
2. 设置 `NODE_EXTRA_CA_CERTS` 指向证书文件

```bash
export NODE_EXTRA_CA_CERTS="/path/to/company-ca-cert.pem"
```

### 仅开发环境

如果只是本地开发，最简单的方法是：

```bash
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

添加到 `~/.zshrc` 使其永久生效。

## 验证修复

修复后，重新启动开发服务器：

```bash
pnpm dev
```

如果不再出现 SSL 错误，说明修复成功。

## 生产环境注意事项

⚠️ **重要**: 在生产环境中，**不要**使用 `NODE_TLS_REJECT_UNAUTHORIZED=0`。

生产环境应该：
1. 使用正确的 CA 证书
2. 配置 `NODE_EXTRA_CA_CERTS` 指向有效的证书文件
3. 确保所有 HTTPS 连接使用有效的 SSL 证书

## 相关资源

- [Node.js TLS 文档](https://nodejs.org/api/tls.html)
- [OpenSSL 证书管理](https://www.openssl.org/docs/manpages.html)
