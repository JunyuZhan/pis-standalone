import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { ApiError } from '@/lib/validation/error-handler'
import { createAdminClient } from '@/lib/database'
import { spawn } from 'child_process'
import { resolve } from 'path'
import { existsSync } from 'fs'

/**
 * 执行升级 API
 * POST /api/admin/upgrade/execute
 * 
 * 请求体：
 * {
 *   skipRestart?: boolean  // 是否跳过容器重启（使用 --no-restart）
 * }
 * 
 * 返回流式输出（Server-Sent Events）
 */
export async function POST(request: NextRequest) {
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

    // 解析请求体
    let body: { skipRestart?: boolean } = {}
    try {
      const bodyText = await request.text()
      if (bodyText) {
        body = JSON.parse(bodyText)
      }
    } catch {
      // 忽略解析错误，使用默认值
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
      
      // 检查这些路径是否存在且包含 scripts/deploy/quick-upgrade.sh
      for (const path of commonPaths) {
        try {
          const scriptPath = resolve(path, 'scripts/deploy/quick-upgrade.sh')
          if (existsSync(scriptPath)) {
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
    
    const upgradeScript = resolve(projectRoot, 'scripts/deploy/quick-upgrade.sh')
    
    // 验证脚本文件是否存在
    if (!existsSync(upgradeScript)) {
      return NextResponse.json(
        {
          error: {
            code: 'SCRIPT_NOT_FOUND',
            message: '升级脚本未找到',
            details: `路径: ${upgradeScript}`,
          },
        },
        { status: 404 }
      )
    }

    // 构建命令参数
    const args: string[] = []
    if (body.skipRestart) {
      args.push('--no-restart')
    }

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        // 发送开始消息
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'start', message: '开始升级...' })}\n\n`)
        )

        // 执行升级脚本
        const child = spawn('bash', [upgradeScript, ...args], {
          cwd: projectRoot,
          env: {
            ...process.env,
            // 确保脚本可以访问必要的环境变量
            PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
          },
        })

        let stdoutBuffer = ''
        let stderrBuffer = ''

        // 处理标准输出
        child.stdout.on('data', (data: Buffer) => {
          const text = data.toString()
          stdoutBuffer += text
          
          // 按行发送输出
          const lines = text.split('\n')
          for (const line of lines) {
            if (line.trim()) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'stdout', message: line })}\n\n`)
              )
            }
          }
        })

        // 处理错误输出
        child.stderr.on('data', (data: Buffer) => {
          const text = data.toString()
          stderrBuffer += text
          
          const lines = text.split('\n')
          for (const line of lines) {
            if (line.trim()) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'stderr', message: line })}\n\n`)
              )
            }
          }
        })

        // 处理进程退出
        child.on('close', (code) => {
          if (code === 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'success', message: '升级完成' })}\n\n`)
            )
          } else {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ 
                  type: 'error', 
                  message: `升级失败，退出码: ${code}`,
                  stdout: stdoutBuffer,
                  stderr: stderrBuffer,
                })}\n\n`
              )
            )
          }
          controller.close()
        })

        // 处理错误
        child.on('error', (error) => {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ 
                type: 'error', 
                message: `执行升级脚本失败: ${error.message}`,
              })}\n\n`
            )
          )
          controller.close()
        })
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('执行升级 API 错误:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务器错误',
          details: error instanceof Error ? error.message : '未知错误',
        },
      },
      { status: 500 }
    )
  }
}
