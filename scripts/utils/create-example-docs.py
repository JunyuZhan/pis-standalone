#!/usr/bin/env python3
"""
创建文档的示例版本，用占位符替换敏感信息

注意：此脚本使用通用模式匹配敏感信息，不包含任何具体的敏感值。
所有替换规则都使用正则表达式模式，可以匹配任何符合格式的敏感信息。
"""

import re
import os

# 敏感信息替换规则
# 注意：这些规则使用通用模式匹配，不包含具体的敏感信息
REPLACEMENTS = [
    # Supabase URLs - 匹配任何 Supabase 项目 URL（20+ 字符的项目 ID）
    (r'https://[a-z0-9]{20,}\.supabase\.co', 'https://your-project-id.supabase.co'),
    
    # JWT tokens - 匹配完整的 JWT token（包括所有点分隔的部分）
    (r'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'),
    
    # Worker API Key - 匹配 64 字符的十六进制字符串（在 API key 上下文中）
    # 注意：这个模式比较宽泛，建议在文档中明确标记 API key 的位置
    (r'(WORKER_)?API[_\s]*KEY[=:]\s*[0-9a-f]{64}', r'\1API_KEY=your-worker-api-key-here'),
    
    # Cloudflare API Token - 在包含 "cloudflare" 的行中匹配长 token
    (r'(CLOUDFLARE[_\s]*)?API[_\s]*TOKEN[=:]\s*[A-Za-z0-9_-]{40,}', r'\1API_TOKEN=your-cloudflare-api-token'),
    
    # Cloudflare Zone ID - 在包含 "zone" 或 "cloudflare" 的行中匹配 32 字符十六进制
    (r'(CLOUDFLARE[_\s]*)?ZONE[_\s]*ID[=:]\s*[0-9a-f]{32}', r'\1ZONE_ID=your-cloudflare-zone-id'),
    
    # Turnstile - 匹配 Turnstile key 格式
    (r'0x4AAAAAAA[^\s]+', 'your-turnstile-key'),
    
    # MinIO/Storage Access Keys - 匹配环境变量中的密钥
    (r'(MINIO_|STORAGE_)(SECRET_|ACCESS_)KEY[=:]\s*[^\s\n]+', r'\1\2KEY=your-\1\2key'),
    
    # Vercel 项目域名 - 匹配 vercel.app 域名
    (r'[a-z0-9-]+\.vercel\.app', 'your-project-name.vercel.app'),
    
    # 自定义域名 - 匹配常见的域名格式（排除已知的占位符和 localhost）
    # 注意：这个模式会匹配大多数域名，但排除常见的占位符
    (r'\b(?!example\.com|localhost|your-domain\.com|your-project-name\.vercel\.app)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.(com|net|org|io|top|app|dev|co|cn)\b', 'your-domain.com'),
    
    # 服务器 IP - 匹配私有 IP 地址范围
    (r'\b(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)[0-9]{1,3}\.[0-9]{1,3}\b', 'YOUR_SERVER_IP'),
    
    # frpc token - 匹配 frpc 配置文件中的 token
    (r'auth\.token\s*=\s*"[^"]+"', 'auth.token = "your-frpc-token"'),
    
    # frpc server address - 匹配 frpc 服务器地址
    (r'serverAddr\s*=\s*"[0-9.]+"', 'serverAddr = "your-frpc-server-ip"'),
]

# 需要创建示例版本的文件
# 注意：只处理实际存在的文件
FILES = [
    'docs/ENVIRONMENT_VARIABLES.md',
    'docs/VERCEL_ENV_QUICK_REFERENCE.md',
    'docs/ARCHITECTURE.md',
    'docs/ENGINEER_REFERENCE.md',
]

def create_example_file(file_path):
    """创建示例版本的文件"""
    if not os.path.exists(file_path):
        print(f"⚠️  文件不存在: {file_path}")
        return
    
    # 读取原文件
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 应用所有替换规则
    for pattern, replacement in REPLACEMENTS:
        content = re.sub(pattern, replacement, content, flags=re.IGNORECASE)
    
    # 添加警告信息
    warning = """<!--
⚠️  这是示例文档，所有敏感信息已用占位符替换
实际配置请参考对应的原始文档（不提交到 Git）
-->
"""
    
    # 写入示例文件
    example_path = file_path.replace('.md', '.example.md')
    with open(example_path, 'w', encoding='utf-8') as f:
        f.write(warning + content)
    
    print(f"✅ 已创建: {example_path}")

def main():
    """主函数"""
    print("创建文档示例版本...")
    print("=" * 50)
    
    for file_path in FILES:
        create_example_file(file_path)
    
    print("=" * 50)
    print("✅ 完成！所有示例文件已创建")
    print("\n注意: 原始文件已添加到 .gitignore，不会被提交到 Git")

if __name__ == '__main__':
    main()
