#!/usr/bin/env node
/**
 * 在容器内创建管理员账号的内联脚本
 * 使用方法: node docker/create-admin-inline.js <email> <password> <db_host> <db_port> <db_name> <db_user> <db_password>
 */

const crypto = require('crypto');
const { promisify } = require('util');
const pbkdf2 = promisify(crypto.pbkdf2);

async function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const iterations = 100000;
  const keylen = 64;
  const digest = 'sha512';
  const derivedKey = await pbkdf2(password, salt, iterations, keylen, digest);
  return `${salt}:${iterations}:${derivedKey.toString('hex')}`;
}

async function createAdmin() {
  const email = process.argv[2];
  const password = process.argv[3]; // 可以为空，表示首次登录时设置
  const dbHost = process.argv[4] || 'postgres';
  const dbPort = parseInt(process.argv[5] || '5432', 10);
  const dbName = process.argv[6] || 'pis';
  const dbUser = process.argv[7] || 'pis';
  const dbPassword = process.argv[8] || '';

  if (!email) {
    console.error('❌ 用法: node create-admin-inline.js <email> [password] [db_host] [db_port] [db_name] [db_user] [db_password]');
    console.error('   注意: password 可以为空，表示首次登录时设置密码');
    process.exit(1);
  }

  try {
    // 尝试加载 pg 模块
    let Client;
    try {
      Client = require('pg').Client;
    } catch (e) {
      // 尝试从不同路径加载
      const paths = [
        '/app/node_modules/pg',
        '/app/apps/web/node_modules/pg',
        '/app/.next/standalone/node_modules/pg',
        '/app/.next/standalone/apps/web/node_modules/pg'
      ];
      
      for (const path of paths) {
        try {
          Client = require(path).Client;
          break;
        } catch (e2) {
          continue;
        }
      }
      
      if (!Client) {
        throw new Error('无法加载 pg 模块，请确保已安装 pg 包');
      }
    }

    // 哈希密码（如果提供了密码）
    let passwordHash = null;
    if (password && password.trim() !== '') {
      console.log('🔐 正在哈希密码...');
      passwordHash = await hashPassword(password);
    }

    // 连接数据库
    const client = new Client({
      host: dbHost,
      port: dbPort,
      database: dbName,
      user: dbUser,
      password: dbPassword
    });

    await client.connect();
    console.log('✅ 已连接到数据库');

    try {
      // 检查用户是否存在
      const checkResult = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (checkResult.rows.length > 0) {
        // 用户已存在，更新密码（如果提供了密码）
        if (password && password.trim() !== '') {
          await client.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
            [passwordHash, email.toLowerCase()]
          );
          console.log('✅ 管理员密码已更新');
        } else {
          console.log('✅ 管理员账户已存在（密码未设置，首次登录时设置）');
        }
      } else {
        // 创建新用户
        // 如果密码为空，password_hash 设为 NULL，表示首次登录需要设置密码
        const passwordHashValue = passwordHash;
        const result = await client.query(
          'INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id',
          [email.toLowerCase(), passwordHashValue, 'admin', true]
        );
        if (passwordHashValue) {
          console.log('✅ 管理员账户创建成功！');
        } else {
          console.log('✅ 管理员账户创建成功！（首次登录时设置密码）');
        }
        console.log(`   ID: ${result.rows[0].id}`);
      }
      console.log(`   邮箱: ${email}`);
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('   提示: 请确保 PostgreSQL 服务正在运行');
    } else if (error.message.includes('pg')) {
      console.error('   提示: 请确保 pg 包已安装');
    }
    process.exit(1);
  }
}

createAdmin();
