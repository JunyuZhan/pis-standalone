/**
 * @fileoverview FTP 服务器模块
 *
 * @description
 * 提供 FTP 文件上传服务，支持：
 * - 基于 Album ID 或 Slug 的认证
 * - 自动上传到存储
 * - 自动触发照片处理任务
 * - 被动模式支持
 *
 * @module worker/ftp-server
 *
 * @example
 * ```typescript
 * import { ftpServerService } from './ftp-server'
 *
 * await ftpServerService.start()
 * ```
 */

import { FtpSrv, FileSystem } from "ftp-srv";
import { networkInterfaces } from "os";
import { join, parse } from "path";
import { createReadStream, promises as fs } from "fs";
import { uploadBuffer } from "./lib/storage/index.js";
import { photoQueue } from "./lib/redis.js";
import logger from "./lib/logger.js";
import { v4 as uuidv4, validate as validateUuid } from "uuid";
// 延迟导入数据库客户端，确保环境变量已加载
// import { db } from "./lib/database/client.js";
let db: any = null;

// 延迟获取数据库客户端
async function getDb() {
  if (!db) {
    const dbModule = await import("./lib/database/client.js");
    db = dbModule.db;
  }
  return db;
}

/**
 * 获取外网 IP 地址（用于被动模式）
 *
 * @returns {string} 外网 IP 地址
 *
 * @internal
 */
function getExternalIp(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      // Skip internal and non-IPv4 addresses
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

/**
 * PIS 文件系统（自定义 FTP 文件系统）
 *
 * @description
 * 继承 ftp-srv 的 FileSystem，重写 write 方法以实现：
 * - 自动上传到存储
 * - 自动创建数据库记录
 * - 自动触发照片处理任务
 *
 * @class
 * @extends {FileSystem}
 */
class PISFileSystem extends FileSystem {
  /** 关联的相册 ID */
  private albumId: string;

  /**
   * 创建文件系统实例
   *
   * @param {any} connection - FTP 连接对象
   * @param {Object} options - 文件系统选项
   * @param {string} options.root - 根目录路径
   * @param {string} options.cwd - 当前工作目录
   * @param {string} albumId - 相册 ID
   */
  constructor(
    connection: any,
    { root, cwd }: { root: string; cwd: string },
    albumId: string,
  ) {
    super(connection, { root, cwd });
    this.albumId = albumId;
  }

  /**
   * 重写 write 方法，实现上传完成后的自动处理
   *
   * @description
   * 1. 写入本地临时文件
   * 2. 上传完成时自动上传到存储
   * 3. 创建数据库记录
   * 4. 触发照片处理任务
   * 5. 清理本地临时文件
   *
   * @param {string} fileName - 文件名
   * @param {Object} options - 写入选项
   * @param {boolean} [options.append] - 是否追加
   * @param {any} [options.start] - 起始位置
   * @returns {any} 文件写入流
   */
  write(
    fileName: string,
    {
      append = false,
      start = undefined,
    }: { append?: boolean; start?: any } = {},
  ) {
    // Call super to handle the actual file writing to local temp dir
    const stream = super.write(fileName, { append, start });

    // Get absolute path
    const { fsPath } = (this as any).resolvePath(fileName);

    // Listen for finish/close event
    stream.once("close", async () => {
      try {
        logger.info(
          { fileName, fsPath, albumId: this.albumId },
          "📸 FTP Upload completed, starting processing...",
        );

        // fileName is relative to root (which is specific to album), e.g. "DSC001.jpg"
        const cleanPath = fileName.startsWith("/")
          ? fileName.slice(1)
          : fileName;
        const originalName = cleanPath.split("/").pop() || "unknown.jpg";

        // Read the file
        const fileBuffer = await fs.readFile(fsPath);

        // Generate a unique ID for the photo
        const photoId = uuidv4();
        const extension = parse(originalName).ext.toLowerCase() || ".jpg";
        const storageKey = `raw/${this.albumId}/${photoId}${extension}`;

        // Upload to Storage (MinIO)
        await uploadBuffer(storageKey, fileBuffer, {
          "Content-Type": "image/jpeg", // Simple assumption
          "x-amz-meta-original-name": encodeURIComponent(originalName),
        });

        logger.info(
          { photoId, albumId: this.albumId, storageKey },
          "☁️  Uploaded to Storage",
        );

        // Insert into Database
        const database = await getDb();
        const { error: insertError } = await database.from("photos").insert({
          id: photoId,
          album_id: this.albumId,
          filename: originalName,
          original_key: storageKey,
          status: "pending",
          file_size: fileBuffer.length,
          mime_type: extension === ".png" ? "image/png" : "image/jpeg", // Simple mime type detection
        });

        if (insertError) {
          logger.error(
            { insertError, photoId },
            "❌ Failed to insert photo record",
          );
          throw new Error("Database insert failed");
        }

        // Add to Processing Queue
        await photoQueue.add(
          "process-photo",
          {
            photoId,
            albumId: this.albumId,
            originalKey: storageKey,
          },
          {
            jobId: photoId, // Deduplication
          },
        );

        logger.info({ jobId: photoId }, "🚀 Added to processing queue");

        // Cleanup local temp file
        await fs.unlink(fsPath);
      } catch (err) {
        logger.error({ err, fileName }, "❌ Error processing FTP upload");
      }
    });

    return stream;
  }
}

/**
 * FTP 服务器服务
 *
 * @description
 * 管理 FTP 服务器的启动、停止和认证。
 * 支持基于 Album ID 或 Upload Token 的认证。
 *
 * @class
 */
export class FtpServerService {
  /** FTP 服务器实例 */
  private ftpServer: FtpSrv | null = null;
  /** FTP 根目录路径 */
  private rootPath: string;

  /**
   * 创建 FTP 服务器服务实例
   */
  constructor() {
    // Use a temp directory for FTP root
    this.rootPath = process.env.FTP_ROOT_DIR || join(process.cwd(), "temp_ftp");
  }

  /**
   * 启动 FTP 服务器
   *
   * @description
   * 配置并启动 FTP 服务器，包括：
   * - 监听端口（默认 21）
   * - 被动模式端口范围（30000-30009）
   * - 认证处理（Album ID 或 Slug + Upload Token）
   *
   * @returns {Promise<void>}
   */
  async start() {
    // Ensure root directory exists
    try {
      await fs.mkdir(this.rootPath, { recursive: true });
    } catch (err) {
      // Ignore if exists
    }

    const port = parseInt(process.env.FTP_PORT || "21");
    const pasvStart = parseInt(process.env.FTP_PASV_START || "30000");
    const pasvEnd = parseInt(process.env.FTP_PASV_END || "30009");

    // In Docker, we might need to advertise the public IP or Hostname
    const pasvUrl = process.env.FTP_PASV_URL || getExternalIp();

    this.ftpServer = new FtpSrv({
      url: `ftp://0.0.0.0:${port}`,
      pasv_url: pasvUrl,
      pasv_min: pasvStart,
      pasv_max: pasvEnd,
      anonymous: false,
      greeting: ["Welcome to PIS FTP Server"],
      timeout: 60000,
    });

    // Handle Authentication
    this.ftpServer.on(
      "login",
      async ({ connection, username, password }, resolve, reject) => {
        try {
          let albumId = "";

          // 1. Check if username is UUID (Album ID)
          if (validateUuid(username)) {
            const { data: album, error } = await db
              .from("albums")
              .select("id, upload_token, is_public")
              .eq("id", username)
              .single();

            if (error || !album) {
              reject(new Error("Album not found"));
              return;
            }

            if (album.upload_token !== password) {
              reject(new Error("Invalid upload token"));
              return;
            }

            albumId = album.id;
          }
          // 2. Check if username is slug (Short Code)
          else {
            const { data: album, error } = await db
              .from("albums")
              .select("id, upload_token")
              .eq("slug", username)
              .single();

            if (error || !album) {
              reject(new Error("Album not found"));
              return;
            }

            if (album.upload_token !== password) {
              reject(new Error("Invalid upload token"));
              return;
            }

            albumId = album.id;
          }

          // Create album-specific temp dir
          const albumRoot = join(this.rootPath, albumId);
          await fs.mkdir(albumRoot, { recursive: true });

          resolve({
            root: albumRoot,
            cwd: "/",
            fs: new PISFileSystem(
              connection,
              { root: albumRoot, cwd: "/" },
              albumId,
            ) as any,
          });
        } catch (err) {
          logger.error({ err, username }, "Login error");
          reject(new Error("Authentication failed"));
        }
      },
    );

    this.ftpServer.on("client-error", ({ connection, context, error }) => {
      logger.error({ error, context }, "FTP Client Error");
    });

    try {
      await this.ftpServer.listen();
      logger.info(
        {
          port,
          pasvUrl,
          pasvRange: `${pasvStart}-${pasvEnd}`,
        },
        "🚀 FTP Server started",
      );
    } catch (err) {
      logger.error({ err }, "❌ Failed to start FTP Server");
    }
  }

  /**
   * 停止 FTP 服务器
   *
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.ftpServer) {
      await this.ftpServer.close();
      logger.info("FTP Server stopped");
    }
  }
}

/** FTP 服务器服务单例 */
export const ftpServerService = new FtpServerService();
