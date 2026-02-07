/**
 * 权限管理 API
 * GET: 获取所有权限定义
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { ApiError, handleApiError, requireAuth } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    // 只有管理员可以查看权限列表
    if (user.role !== "admin") {
      throw new ApiError("无权访问权限管理", 403);
    }

    const db = createServerSupabaseClient();

    // 获取所有权限
    const { data: permissions, error } = await db
      .from("permissions")
      .select("*")
      .order("category")
      .order("code");

    if (error) {
      throw new ApiError(`获取权限失败: ${error.message}`, 500);
    }

    // 获取角色权限（使用 JOIN 查询，因为 PostgreSQL 客户端不支持 Supabase 的关联查询语法）
    const { data: rolePermissions, error: rolePermsError } = await db.query<{
      role: string;
      permission_id: string;
      code: string;
    }>(`
      SELECT 
        rp.role,
        rp.permission_id,
        p.code
      FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      ORDER BY rp.role, p.code
    `);

    if (rolePermsError) {
      throw new ApiError(`获取角色权限失败: ${rolePermsError.message}`, 500);
    }

    // 整理角色权限数据
    const rolePermsMap: Record<string, string[]> = {};
    const rolePermsArray = rolePermissions || [];
    for (const rp of rolePermsArray) {
      if (!rolePermsMap[rp.role]) {
        rolePermsMap[rp.role] = [];
      }
      if (rp.code) {
        rolePermsMap[rp.role].push(rp.code);
      }
    }

    return NextResponse.json({
      permissions: permissions || [],
      rolePermissions: rolePermsMap,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
