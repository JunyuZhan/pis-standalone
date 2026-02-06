/**
 * PIS Web Application - Root Layout
 *
 * @author junyuzhan
 * @license MIT
 */

import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { Providers } from "@/components/providers";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { SiteFooter } from "@/components/site-footer";
import { getSafeMediaUrl } from "@/lib/utils";

// 使用本地字体文件（避免 Google Fonts 网络依赖）
// 字体文件应放在 apps/web/src/app/fonts/ 目录下（Next.js localFont 要求相对于源文件）
// 或者放在 apps/web/public/fonts/ 目录下，使用系统字体回退
const inter = localFont({
  src: [
    {
      path: "./fonts/Inter-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/Inter-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/Inter-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: [
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Roboto",
    "sans-serif",
  ],
});

const notoSerifSC = localFont({
  src: [
    {
      path: "./fonts/NotoSerifSC-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/NotoSerifSC-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/NotoSerifSC-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-noto-serif-sc",
  display: "swap",
  fallback: ["PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "serif"],
});

const playfairDisplay = localFont({
  src: [
    {
      path: "./fonts/PlayfairDisplay-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/PlayfairDisplay-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/PlayfairDisplay-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-playfair-display",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

// Metadata will be generated dynamically based on locale
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  // Messages are loaded but not used in metadata (only used in layout)
  const messages = await getMessages();

  // Get translations for metadata
  const title = (messages as { home?: { title?: string } })?.home?.title || 
    (locale === "zh-CN" ? "PIS - 专业级摄影分享" : "PIS - Professional Photo Sharing");
  const description = (messages as { home?: { description?: string } })?.home?.description || 
    (locale === "zh-CN" ? "私有化即时摄影分享系统，让每一刻精彩即时呈现" : "Private Instant photo Sharing system");

  return {
    title,
    description,
    manifest: "/manifest.json",
    icons: {
      icon: "/favicon.ico",
      apple: "/icons/icon-192x192.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "PIS",
    },
    formatDetection: {
      telephone: false,
    },
    openGraph: {
      type: "website",
      siteName: "PIS",
      title,
      description,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#D4AF37",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const messages = await getMessages();

  // 获取媒体服务器域名用于预连接
  // 使用安全的媒体 URL（自动修复 localhost HTTPS 问题）
  const mediaUrl = getSafeMediaUrl();
  // 只有当 mediaUrl 是绝对 URL 时才进行 DNS prefetch/preconnect
  // 如果是相对路径（如 /media），则跳过 prefetch（浏览器会自动处理）
  let mediaHost: string | null = null;
  try {
    if (mediaUrl && mediaUrl.startsWith("http")) {
      const url = new URL(mediaUrl);
      // 避免对 localhost HTTPS 进行 prefetch（可能导致问题）
      if (!(url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
        mediaHost = url.origin;
      }
    }
  } catch {
    // URL 解析失败，可能是相对路径，跳过 prefetch
  }

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${notoSerifSC.variable} ${playfairDisplay.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* 主题初始化脚本（防止闪烁） */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('pis-theme') || 'system';
                  var resolved = theme;
                  if (theme === 'system') {
                    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.classList.add(resolved);
                  
                  var color = localStorage.getItem('pis-primary-color') || '#4F46E5';
                  var hex = color.replace('#', '');
                  var r = parseInt(hex.substring(0, 2), 16);
                  var g = parseInt(hex.substring(2, 4), 16);
                  var b = parseInt(hex.substring(4, 6), 16);
                  document.documentElement.style.setProperty('--color-accent', r + ' ' + g + ' ' + b);
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
        {/* 性能优化：DNS 预解析和预连接 */}
        {mediaHost && (
          <>
            <link rel="dns-prefetch" href={mediaHost} />
            <link rel="preconnect" href={mediaHost} crossOrigin="anonymous" />
          </>
        )}
        {/* 本地字体，无需预连接 Google Fonts */}

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />

        {/* PWA Apple 特定 meta */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="PIS" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link
          rel="apple-touch-icon"
          sizes="152x152"
          href="/icons/icon-152x152.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/icons/icon-192x192.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="167x167"
          href="/icons/icon-192x192.png"
        />
        {/* Splash screens for iOS */}
        <link
          rel="apple-touch-startup-image"
          href="/splash/splash-1170x2532.png"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/splash-1284x2778.png"
          media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)"
        />
      </head>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            {children}
            <SiteFooter />
            <PWAInstallPrompt />
          </Providers>
        </NextIntlClientProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
