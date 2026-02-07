"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { ChevronDown, Aperture } from "lucide-react";
import { useTranslations } from "next-intl";
import { getSafeMediaUrl } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import type { Album, Photo } from "@/types/database";

interface HomeHeroProps {
  featuredAlbum?: Album | null;
  coverPhoto?: Photo | null;
}

export function HomeHero({ featuredAlbum, coverPhoto }: HomeHeroProps) {
  const t = useTranslations("home.hero");
  const { resolvedTheme } = useTheme();
  const [isLoaded, setIsLoaded] = useState(false);
  // 默认假设用户偏好减少动画，确保文字初始可见
  // 如果检测到用户不偏好减少动画，再启用动画效果
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);
  // 使用安全的媒体 URL（自动修复 localhost HTTPS 问题）
  const mediaUrl = getSafeMediaUrl();
  const { scrollY } = useScroll();

  // 判断是否为亮色模式
  const isLightMode = resolvedTheme === "light";

  // 检测用户是否偏好减少动画
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Parallax效果：背景图片随滚动移动
  const backgroundY = useTransform(scrollY, [0, 600], ["0%", "30%"]);

  // 获取封面图 URL
  const coverUrl = coverPhoto?.preview_key
    ? `${mediaUrl}/${coverPhoto.preview_key}`
    : coverPhoto?.thumb_key
      ? `${mediaUrl}/${coverPhoto.thumb_key}`
      : null;

  return (
    <div className="relative w-full h-[70vh] sm:h-[75vh] min-h-[400px] sm:min-h-[500px] max-h-[600px] sm:max-h-[800px] overflow-hidden pt-14 sm:pt-16">
      {/* 背景图片 - 带parallax效果 */}
      {coverUrl ? (
        <motion.div
          style={{
            y: prefersReducedMotion ? 0 : backgroundY,
          }}
          className="absolute inset-0 -z-10"
        >
          <div className="absolute inset-0 w-full h-[130%]">
            <Image
              src={coverUrl}
              alt={
                featuredAlbum?.title ||
                process.env.NEXT_PUBLIC_PHOTOGRAPHER_NAME ||
                "PIS Photography"
              }
              fill
              priority
              className={`object-cover transition-all duration-1000 ${
                isLoaded ? "scale-100 blur-0" : "scale-110 blur-md"
              }`}
              onLoad={() => setIsLoaded(true)}
              sizes="100vw"
            />
          </div>
        </motion.div>
      ) : (
        <>
          {/* 亮色模式下的渐变背景 - 增加视觉层次 */}
          <div className="absolute inset-0 bg-gradient-to-br from-background via-surface-elevated/50 to-surface" />
          {/* 金色渐变装饰 */}
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/10" />
          {/* 装饰性几何图形 */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </>
      )}

      {/* 渐变遮罩 - 多层叠加创造深度（仅在有背景图片时显示） */}
      {coverUrl && (
        <>
          {/* 深色模式下增强遮罩，确保文字可见 */}
          {!isLightMode ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/50" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/80" />
              <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/70 to-background/90" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/40" />
            </>
          )}
        </>
      )}

      {/* 内容区域 */}
      <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-4 sm:px-6 z-10">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          {/* Logo/品牌标识 */}
          <motion.div
            initial={{
              opacity: prefersReducedMotion ? 1 : 0,
              y: prefersReducedMotion ? 0 : 20,
            }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.6,
              ease: "easeOut",
            }}
            className="flex items-center justify-center gap-2 sm:gap-3 mb-2 sm:mb-3"
          >
            <Aperture className="w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 text-accent" />
            <span
              className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif font-bold tracking-wider ${
                isLightMode && coverUrl
                  ? "text-text-primary text-glow-gold"
                  : isLightMode
                    ? "text-text-primary text-glow-gold-light"
                    : "text-text-primary"
              }`}
            >
              PIS
            </span>
          </motion.div>

          {/* 主标题 */}
          <motion.h1
            initial={{
              opacity: prefersReducedMotion ? 1 : 0,
              y: prefersReducedMotion ? 0 : 30,
            }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.7,
              delay: prefersReducedMotion ? 0 : 0.1,
              ease: "easeOut",
            }}
            className={`text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-serif font-bold leading-tight px-2 ${
              isLightMode && coverUrl
                ? "text-text-primary text-glow-gold-lg"
                : isLightMode
                  ? "text-text-primary text-glow-gold-light-lg"
                  : "text-text-primary"
            }`}
          >
            {t("title")}
            <br />
            <span
              className={`text-accent ${isLightMode && coverUrl ? "text-glow-gold" : isLightMode ? "text-glow-gold-light" : ""}`}
            >
              {t("subtitle")}
            </span>
          </motion.h1>

          {/* 副标题 */}
          <motion.p
            initial={{
              opacity: prefersReducedMotion ? 1 : 0,
              y: prefersReducedMotion ? 0 : 20,
            }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.7,
              delay: prefersReducedMotion ? 0 : 0.2,
              ease: "easeOut",
            }}
            className={`text-sm sm:text-base md:text-lg lg:text-xl font-light tracking-wide max-w-2xl mx-auto px-2 ${
              isLightMode && coverUrl
                ? "text-text-primary"
                : isLightMode
                  ? "text-text-secondary text-glow-gold-light-md"
                  : "text-text-secondary"
            }`}
          >
            {t("tagline")}
          </motion.p>

          {/* 特色相册信息 */}
          {featuredAlbum && (
            <motion.div
              initial={{
                opacity: prefersReducedMotion ? 1 : 0,
                y: prefersReducedMotion ? 0 : 20,
              }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.7,
                delay: prefersReducedMotion ? 0 : 0.3,
                ease: "easeOut",
              }}
              className="pt-2 sm:pt-4"
            >
              <div
                className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 backdrop-blur-md rounded-full ${
                  isLightMode && coverUrl
                    ? "bg-background/80 border border-border"
                    : isLightMode
                      ? "bg-surface-elevated/80 border border-border"
                      : coverUrl
                        ? "bg-background/60 border border-white/10"
                        : "bg-surface-elevated/80 border border-border"
                }`}
              >
                <span
                  className={`text-[10px] sm:text-xs ${
                    isLightMode && coverUrl
                      ? "text-text-secondary"
                      : isLightMode
                        ? "text-text-secondary"
                        : "text-text-secondary"
                  }`}
                >
                  {t("latest")}
                </span>
                <span className="w-1 h-1 bg-accent rounded-full" />
                <span
                  className={`text-xs sm:text-sm font-medium line-clamp-1 max-w-[200px] sm:max-w-none ${
                    isLightMode && coverUrl
                      ? "text-text-primary"
                      : "text-text-primary"
                  }`}
                >
                  {featuredAlbum.title}
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* 向下滚动提示 */}
      <motion.a
        href="#works"
        initial={{ opacity: prefersReducedMotion ? 1 : 0 }}
        animate={{ opacity: 1 }}
        transition={{
          delay: prefersReducedMotion ? 0 : 1.2,
          duration: prefersReducedMotion ? 0 : 0.5,
        }}
        className={`absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-pointer transition-colors touch-manipulation ${
          isLightMode && coverUrl
            ? "text-text-secondary hover:text-text-primary"
            : "text-text-secondary hover:text-text-primary"
        }`}
      >
        <span className="text-[10px] sm:text-xs mb-1 sm:mb-2 tracking-wider uppercase">
          {t("explore")}
        </span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
            repeatType: "reverse",
          }}
        >
          <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6" />
        </motion.div>
      </motion.a>

      {/* 装饰性光效 */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
    </div>
  );
}
