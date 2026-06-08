import type { Config } from "tailwindcss";

/**
 * E13 高齢者向け UX 基盤のデザイントークン。
 *
 * - 基準フォントは 16px 以上 (text-base = 1rem)、行間 1.5 を既定とする。
 * - 状態色は「色のみで意味を伝えない」前提で、Badge 等では必ずアイコン + テキストと併用する。
 * - フォーカスリングは常時可視 (focus-visible) で 2px 以上を確保。
 * - タッチターゲットは最小 44px (min-h-touch / min-w-touch) を共通ユーティリティ化。
 */
const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // 本文: クリーンな和文ゴシック (next/font の Zen Kaku Gothic New を優先)。
        // var(--font-sans) 未解決時もシステムゴシックへフォールバックし画面は壊れない。
        sans: [
          "var(--font-sans)",
          "'Hiragino Sans'",
          "'Hiragino Kaku Gothic ProN'",
          "'Yu Gothic'",
          "Meiryo",
          "sans-serif",
        ],
        // 見出し: 少し丸みのある温かいゴシック (next/font の Zen Maru Gothic を優先)。
        rounded: [
          "var(--font-rounded)",
          "'Hiragino Maru Gothic ProN'",
          "'Hiragino Sans'",
          "'Yu Gothic'",
          "Meiryo",
          "sans-serif",
        ],
        // serif は当面残置 (緊急フォールバック / 将来用)。新規利用はしない方針。
        serif: [
          "'Noto Serif JP'",
          "'Hiragino Mincho ProN'",
          "'Yu Mincho'",
          "serif",
        ],
      },
      // 高齢者向け: 既定で大きめ・行間広め。最小でも 16px (base)。
      fontSize: {
        xs: ["0.875rem", { lineHeight: "1.5" }], // 14px (補助情報のみ)
        sm: ["0.9375rem", { lineHeight: "1.5" }], // 15px
        base: ["1rem", { lineHeight: "1.6" }], // 16px
        lg: ["1.125rem", { lineHeight: "1.6" }], // 18px
        xl: ["1.25rem", { lineHeight: "1.5" }], // 20px
        "2xl": ["1.5rem", { lineHeight: "1.4" }], // 24px
        "3xl": ["1.875rem", { lineHeight: "1.3" }], // 30px
      },
      minHeight: {
        touch: "2.75rem", // 44px タッチターゲット最小
      },
      minWidth: {
        touch: "2.75rem",
      },
      colors: {
        // セマンティックトークン (globals.css の CSS 変数を参照)。
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        border: "var(--border)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        // 濃色ニュートラルの地 (ヘッダー文字色 / ダーク帯など旧 primary の near-black 用途)
        ink: "var(--ink)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        // ブランド (温かい橙)。bg-brand text-brand-foreground / hover:bg-brand-hover /
        // bg-brand-soft text-brand-soft-foreground (チップ) で使う。
        brand: {
          DEFAULT: "var(--brand)",
          hover: "var(--brand-hover)",
          foreground: "var(--brand-foreground)",
          soft: "var(--brand-soft)",
          "soft-foreground": "var(--brand-soft-foreground)",
        },
        // 差し色 (黄系の濃い琥珀茶)
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
        },
        // 状態色 (WCAG AA: 白文字とのコントラスト比 4.5:1 以上を満たす濃さ)
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
          soft: "var(--success-soft)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
          soft: "var(--warning-soft)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          foreground: "var(--danger-foreground)",
          soft: "var(--danger-soft)",
        },
        info: {
          DEFAULT: "var(--info)",
          foreground: "var(--info-foreground)",
          soft: "var(--info-soft)",
        },
      },
      borderRadius: {
        DEFAULT: "0.375rem",
      },
      ringWidth: {
        DEFAULT: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
