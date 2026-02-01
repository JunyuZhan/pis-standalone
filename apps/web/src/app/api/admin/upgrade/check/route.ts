import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { ApiError } from '@/lib/validation/error-handler'
import { createAdminClient } from '@/lib/database'
import { exec } from 'child_process'
import { promisify } from 'util'
import { resolve } from 'path'
import { existsSync } from 'fs'

const execAsync = promisify(exec)

/**
 * 检查升级状态 API
 * GET /api/admin/upgrade/check
 * 
 * 返回：
 * {
 *   currentCommit: string,      // 当前提交哈希
 *   currentBranch: string,       // 当前分支
 *   remoteCommit: string,        // 远程最新提交哈希
 *   hasUpdate: boolean,          // 是否有更新
 *   uncommittedChanges: boolean, // 是否有未提交的更改
 *   lastChecked: string          // 最后检查时间
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // 验证登录状态和管理员权限
    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    // 从数据库查询用户角色
    const db = await createAdminClient()
    const { data: userData } = await db
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userData || (userData as { role?: string }).role !== 'admin') {
      return ApiError.forbidden('只有管理员可以执行此操作')
    }

    // 获取项目根目录
    // 优先级：环境变量 > Docker 容器挂载路径（/opt/pis-standalone） > 从当前文件位置推断
    let projectRoot = process.env.PROJECT_ROOT
    
    if (!projectRoot) {
      // 尝试常见的 Docker 部署路径
      const commonPaths = [
        '/opt/pis-standalone',  // Docker 容器挂载路径（docker-compose 中配置）
        '/app',                  // Docker 容器内 Next.js 应用路径
      ]
      
      // 检查这些路径是否存在且包含 .env.example 或 scripts/deploy/quick-upgrade.sh
      for (const path of commonPaths) {
        try {
          if (existsSync(resolve(path, '.env.example')) || 
              existsSync(resolve(path, 'scripts/deploy/quick-upgrade.sh'))) {
            projectRoot = path
            break
          }
        } catch {
          // 忽略错误，继续尝试下一个路径
        }
      }
      
      // 如果都没找到，从当前工作目录推断
      if (!projectRoot) {
        const cwd = process.cwd()
        // 如果当前在 apps/web 目录，向上两级到项目根目录
        if (cwd.includes('/apps/web')) {
          projectRoot = resolve(cwd, '../..')
        } else {
          // 否则尝试从当前目录向上查找
          projectRoot = resolve(cwd, '../..')
        }
      }
    }
    
    try {
      // 检查 Git 状态
      const { stdout: currentBranch } = await execAsync(
        'git rev-parse --abbrev-ref HEAD',
        { cwd: projectRoot }
      )

      const { stdout: currentCommit } = await execAsync(
        'git rev-parse HEAD',
        { cwd: projectRoot }
      )

      // 检查是否有未提交的更改
      let uncommittedChanges = false
      try {
        await execAsync('git diff-index --quiet HEAD --', { cwd: projectRoot })
      } catch {
        uncommittedChanges = true
      }

      // 获取远程最新提交
      let remoteCommit = ''
      let hasUpdate = false
      try {
        // 先 fetch
        await execAsync('git fetch origin', { cwd: projectRoot })
        
        // 获取远程分支的最新提交
        const branch = currentBranch.trim()
        const { stdout: remoteCommitOutput } = await execAsync(
          `git rev-parse origin/${branch}`,
          { cwd: projectRoot }
        )
        remoteCommit = remoteCommitOutput.trim()
        
        // 比较本地和远程提交
        if (remoteCommit && remoteCommit !== currentCommit.trim()) {
          hasUpdate = true
        }
      } catch (error) {
        // 如果无法获取远程信息，记录但不报错
        console.warn('无法获取远程 Git 信息:', error)
      }

      return NextResponse.json({
        currentCommit: currentCommit.trim(),
        currentBranch: currentBranch.trim(),
        remoteCommit: remoteCommit || null,
        hasUpdate,
        uncommittedChanges,
        lastChecked: new Date().toISOString(),
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      console.error('检查 Git 状态失败:', errorMessage)
      
      return NextResponse.json(
        {
          error: {
            code: 'GIT_CHECK_FAILED',
            message: '无法检查 Git 状态',
            details: errorMessage,
          },
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('升级检查 API 错误:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务器错误',
        },
      },
      { status: 500 }
    )
  }
}
