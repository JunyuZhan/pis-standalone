/**
 * 告警服务模块
 * 支持多种通知渠道：Telegram、邮件、日志
 *
 * 环境变量配置：
 * - ALERT_ENABLED: 启用告警 (默认: true)
 * - ALERT_TYPE: 告警类型 telegram|email|log (默认: log)
 * - TELEGRAM_BOT_TOKEN: Telegram 机器人 Token
 * - TELEGRAM_CHAT_ID: Telegram 聊天 ID
 * - ALERT_SMTP_HOST: SMTP 服务器
 * - ALERT_SMTP_PORT: SMTP 端口
 * - ALERT_SMTP_USER: SMTP 用户名
 * - ALERT_SMTP_PASS: SMTP 密码
 * - ALERT_FROM_EMAIL: 发件人邮箱
 * - ALERT_TO_EMAIL: 收件人邮箱
 */

export interface AlertData {
  title: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, any>;
}

export interface AlertResult {
  success: boolean;
  channel: string;
  error?: string;
}

/**
 * 告警服务类
 */
export class AlertService {
  private enabled: boolean;
  private type: string;
  private telegramConfig?: {
    botToken: string;
    chatId: string;
  };
  private emailConfig?: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
    to: string;
  };

  constructor() {
    this.enabled = process.env.ALERT_ENABLED !== 'false';
    this.type = process.env.ALERT_TYPE || 'log';

    // Telegram 配置
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (botToken && chatId) {
      this.telegramConfig = { botToken, chatId };
    }

    // 邮件配置
    const smtpHost = process.env.ALERT_SMTP_HOST;
    const smtpPort = process.env.ALERT_SMTP_PORT;
    const smtpUser = process.env.ALERT_SMTP_USER;
    const smtpPass = process.env.ALERT_SMTP_PASS;
    const fromEmail = process.env.ALERT_FROM_EMAIL;
    const toEmail = process.env.ALERT_TO_EMAIL;
    if (smtpHost && smtpPort && fromEmail && toEmail) {
      this.emailConfig = {
        host: smtpHost,
        port: parseInt(smtpPort),
        user: smtpUser || '',
        pass: smtpPass || '',
        from: fromEmail,
        to: toEmail,
      };
    }

    // 验证配置
    this.validateConfig();
  }

  /**
   * 验证配置
   */
  private validateConfig() {
    if (this.enabled) {
      if (this.type === 'telegram' && !this.telegramConfig) {
        console.warn('[Alert] Telegram alert type configured but TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set, falling back to log');
        this.type = 'log';
      }
      if (this.type === 'email' && !this.emailConfig) {
        console.warn('[Alert] Email alert type configured but SMTP settings not complete, falling back to log');
        this.type = 'log';
      }
    }
  }

  /**
   * 发送告警
   */
  async send(alert: AlertData): Promise<AlertResult> {
    if (!this.enabled) {
      return { success: true, channel: 'disabled' };
    }

    const timestamp = new Date().toISOString();
    const emoji = this.getEmoji(alert.level);

    // 日志记录（始终记录）
    this.logToConsole(alert, timestamp, emoji);

    // 根据类型发送通知
    switch (this.type) {
      case 'telegram':
        return this.sendToTelegram(alert, timestamp, emoji);
      case 'email':
        return this.sendToEmail(alert, timestamp, emoji);
      case 'log':
      default:
        return { success: true, channel: 'log' };
    }
  }

  /**
   * 发送到 Telegram
   */
  private async sendToTelegram(alert: AlertData, timestamp: string, emoji: string): Promise<AlertResult> {
    if (!this.telegramConfig) {
      return { success: false, channel: 'telegram', error: 'Telegram config not set' };
    }

    try {
      const { botToken, chatId } = this.telegramConfig;

      // 构建消息
      let message = `${emoji} *${alert.level.toUpperCase()}*: ${alert.title}\n\n`;
      message += `${alert.message}\n\n`;
      message += `📅 ${timestamp}`;

      // 添加元数据
      if (alert.metadata && Object.keys(alert.metadata).length > 0) {
        message += '\n\n📋 *Details*:\n';
        for (const [key, value] of Object.entries(alert.metadata)) {
          message += `• ${key}: ${value}\n`;
        }
      }

      // 发送消息
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      });

      const data = await response.json() as { ok: boolean; description?: string };

      if (!data.ok) {
        throw new Error(data.description || 'Unknown error');
      }

      return { success: true, channel: 'telegram' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Alert] Failed to send Telegram notification:`, errorMessage);
      return { success: false, channel: 'telegram', error: errorMessage };
    }
  }

  /**
   * 发送到邮件
   */
  private async sendToEmail(alert: AlertData, timestamp: string, emoji: string): Promise<AlertResult> {
    if (!this.emailConfig) {
      return { success: false, channel: 'email', error: 'Email config not set' };
    }

    try {
      // 使用 nodemailer 发送邮件
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodemailer = await import('nodemailer') as any;
      const transporter = nodemailer.createTransport({
        host: this.emailConfig.host,
        port: this.emailConfig.port,
        secure: this.emailConfig.port === 465,
        auth: {
          user: this.emailConfig.user,
          pass: this.emailConfig.pass,
        },
      });

      let html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${this.getColor(alert.level)};">${emoji} ${alert.level.toUpperCase()}: ${alert.title}</h2>
          <p style="font-size: 16px; line-height: 1.6;">${alert.message}</p>
          <p style="color: #666; font-size: 14px;">📅 ${timestamp}</p>
      `;

      if (alert.metadata && Object.keys(alert.metadata).length > 0) {
        html += '<h3 style="margin-top: 20px;">📋 Details:</h3><ul style="list-style: none; padding: 0;">';
        for (const [key, value] of Object.entries(alert.metadata)) {
          html += `<li style="padding: 4px 0;"><strong>${key}:</strong> ${value}</li>`;
        }
        html += '</ul>';
      }

      html += `
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">This is an automated notification from PIS Worker Service.</p>
        </div>
      `;

      await transporter.sendMail({
        from: this.emailConfig.from,
        to: this.emailConfig.to,
        subject: `[${alert.level.toUpperCase()}] ${alert.title}`,
        html,
      });

      return { success: true, channel: 'email' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Alert] Failed to send email notification:`, errorMessage);
      return { success: false, channel: 'email', error: errorMessage };
    }
  }

  /**
   * 记录到控制台
   */
  private logToConsole(alert: AlertData, timestamp: string, emoji: string) {
    const logMethod = alert.level === 'critical' || alert.level === 'error' ? 'error' :
                      alert.level === 'warning' ? 'warn' : 'log';

    const message = `[Alert] ${emoji} [${alert.level.toUpperCase()}] ${alert.title} - ${alert.message}`;

    console[logMethod](message, alert.metadata || '');

    // 如果有元数据，也打印详细信息
    if (alert.metadata && Object.keys(alert.metadata).length > 0) {
      console[logMethod]('  Metadata:', JSON.stringify(alert.metadata, null, 2));
    }
  }

  /**
   * 获取 emoji
   */
  private getEmoji(level: string): string {
    const emojis: Record<string, string> = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      critical: '🚨',
    };
    return emojis[level] || '📢';
  }

  /**
   * 获取颜色
   */
  private getColor(level: string): string {
    const colors: Record<string, string> = {
      info: '#3498db',
      warning: '#f39c12',
      error: '#e74c3c',
      critical: '#c0392b',
    };
    return colors[level] || '#333';
  }

  /**
   * 便捷方法：发送照片处理失败告警
   */
  async photoProcessingFailed(photoId: string, albumId: string, error: string) {
    return this.send({
      title: '照片处理失败',
      message: `照片 ${photoId} 在相册 ${albumId} 中处理失败`,
      level: 'error',
      metadata: {
        photoId,
        albumId,
        error,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * 便捷方法：发送 Worker 服务异常告警
   */
  async workerServiceError(error: string, context?: Record<string, any>) {
    return this.send({
      title: 'Worker 服务异常',
      message: error,
      level: 'critical',
      metadata: {
        ...context,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * 便捷方法：发送数据不一致告警
   */
  async dataInconsistency(type: string, details: Record<string, any>) {
    return this.send({
      title: '数据不一致',
      message: `检测到 ${type} 数据不一致`,
      level: 'warning',
      metadata: details,
    });
  }

  /**
   * 便捷方法：发送存储空间告警
   */
  async storageUsage(usedBytes: number, totalBytes: number, percentage: number) {
    return this.send({
      title: '存储空间告警',
      message: `存储空间使用率已达到 ${percentage.toFixed(1)}%`,
      level: percentage > 90 ? 'critical' : 'warning',
      metadata: {
        used: `${(usedBytes / 1024 / 1024 / 1024).toFixed(2)} GB`,
        total: `${(totalBytes / 1024 / 1024 / 1024).toFixed(2)} GB`,
        percentage: `${percentage.toFixed(1)}%`,
      },
    });
  }
}

// 导出单例
export const alertService = new AlertService();
