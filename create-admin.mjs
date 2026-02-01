import { createClient } from "./apps/web/src/lib/database/index.js";
import { hashPassword } from "./apps/web/src/lib/auth/password.js";
import { generateId } from "./apps/web/src/lib/utils/ids.js";

async function createAdmin() {
  const db = await createClient();

  // 检查是否已有管理员
  const { data: existingAdmin } = await db.from("users").select("id").single();

  if (existingAdmin) {
    console.log("✅ Admin already exists:", existingAdmin.id);
    process.exit(0);
  }

  // 创建管理员
  const hashedPassword = await hashPassword("admin123");

  const { error } = await db.from("users").insert({
    id: generateId(),
    email: "admin@example.com",
    password: hashedPassword,
    name: "Admin",
    role: "admin",
  });

  if (error) {
    console.error("❌ Failed to create admin:", error);
    process.exit(1);
  }

  console.log("✅ Admin user created successfully");
  console.log("Email: admin@example.com");
  console.log("Password: admin123");
  process.exit(0);
}

createAdmin().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
