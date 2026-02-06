import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/role-helpers'
import { ApiError } from '@/lib/validation/error-handler'
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
    // 验证管理员权限
    const admin = await requireAdmin(request)
    if (!admin) {
      return ApiError.forbidden('只有管理员可以执行此操作')
    }

    // 获取项目根目录
    // 优先级：环境变量 PROJECT_ROOT > 从当前文件位置推断
    // 注意：不要硬编码容器路径，应该通过环境变量配置
    let projectRoot = process.env.PROJECT_ROOT
    
    if (!projectRoot) {
      // 从当前工作目录推断（适用于开发环境和未配置 PROJECT_ROOT 的情况）
      const cwd = process.cwd()
      // 如果当前在 apps/web 目录，向上两级到项目根目录
      if (cwd.includes('/apps/web')) {
        projectRoot = resolve(cwd, '../..')
      } else {
        // 否则尝试从当前目录向上查找
        projectRoot = resolve(cwd, '../..')
      }
      
      // 验证推断的路径是否包含 Git 仓库标识
      if (!existsSync(resolve(projectRoot, '.git'))) {
        // 如果推断的路径不是 Git 仓库，尝试向上查找
        let currentPath = projectRoot
        for (let i = 0; i < 5; i++) {
          const parentPath = resolve(currentPath, '..')
          if (parentPath === currentPath) break // 已到达根目录
          if (existsSync(resolve(parentPath, '.git'))) {
            projectRoot = parentPath
            break
          }
          currentPath = parentPath
        }
      }
    }
    
    try {
      // 首先检查 Git 是否可用
      try {
        await execAsync('git --version', { cwd: projectRoot, timeout: 5000 })
      } catch {
        // Git 不可用，返回友好的错误信息
        return NextResponse.json(
          {
            error: {
              code: 'GIT_NOT_AVAILABLE',
              message: 'Git 不可用',
              details: 'Docker 容器内可能未安装 Git，或 Git 命令执行失败。升级功能需要 Git 支持。',
            },
          },
          { status: 503 }
        )
      }

      // 配置 Git safe.directory（Docker 容器中必需）
      // Git 2.35.2+ 要求明确信任非当前用户所有的目录
      try {
        await execAsync(`git config --global --add safe.directory ${projectRoot}`, { timeout: 5000 })
      } catch {
        // 配置失败不阻塞，继续尝试
        console.warn('无法配置 Git safe.directory，继续尝试...')
      }

      // 检查是否是 Git 仓库
      try {
        await execAsync('git rev-parse --git-dir', { cwd: projectRoot, timeout: 5000 })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : ''
        // 检查是否是 safe.directory 相关错误
        if (errorMessage.includes('dubious ownership') || errorMessage.includes('safe.directory')) {
          return NextResponse.json(
            {
              error: {
                code: 'GIT_SAFE_DIRECTORY',
                message: 'Git 安全目录配置问题',
                details: `请在容器中执行: git config --global --add safe.directory ${projectRoot}`,
              },
            },
            { status: 400 }
          )
        }
        return NextResponse.json(
          {
            error: {
              code: 'NOT_A_GIT_REPO',
              message: '当前目录不是 Git 仓库',
              details: `项目根目录 ${projectRoot} 不是有效的 Git 仓库。请确保已正确挂载项目目录。`,
            },
          },
          { status: 400 }
        )
      }

      // 检查 Git 状态
      let currentBranch = ''
      let currentCommit = ''
      let uncommittedChanges = false
      let remoteCommit = ''
      let hasUpdate = false

      try {
        const { stdout: branchOutput } = await execAsync(
          'git rev-parse --abbrev-ref HEAD',
          { cwd: projectRoot, timeout: 5000 }
        )
        currentBranch = branchOutput.trim()

        const { stdout: commitOutput } = await execAsync(
          'git rev-parse HEAD',
          { cwd: projectRoot, timeout: 5000 }
        )
        currentCommit = commitOutput.trim()

        // 检查是否有未提交的更改
        try {
          await execAsync('git diff-index --quiet HEAD --', { cwd: projectRoot, timeout: 5000 })
        } catch {
          uncommittedChanges = true
        }

        // 获取远程最新提交
        try {
          // 先 fetch（设置超时，避免长时间等待）
          await execAsync('git fetch origin', { cwd: projectRoot, timeout: 10000 })
          
          // 获取远程分支的最新提交
          const { stdout: remoteCommitOutput } = await execAsync(
            `git rev-parse origin/${currentBranch}`,
            { cwd: projectRoot, timeout: 5000 }
          )
          remoteCommit = remoteCommitOutput.trim()
          
          // 比较本地和远程提交
          if (remoteCommit && remoteCommit !== currentCommit) {
            hasUpdate = true
          }
        } catch (error) {
          // 如果无法获取远程信息，记录但不报错
          console.warn('无法获取远程 Git 信息:', error instanceof Error ? error.message : error)
        }

        return NextResponse.json({
          currentCommit,
          currentBranch,
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
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      console.error('Git 检查初始化失败:', errorMessage)
      
      return NextResponse.json(
        {
          error: {
            code: 'GIT_INIT_FAILED',
            message: 'Git 检查初始化失败',
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
