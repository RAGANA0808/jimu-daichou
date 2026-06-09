import type { Metadata } from "next";
import { Zen_Kaku_Gothic_New, Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";
import { FontScaleScript } from "@/components/ui/font-scale-switcher";

// 本文用 クリーンな和文ゴシック。日本語フォントは subsets 指定不可のため preload は false 必須。
const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
  variable: "--font-sans",
  fallback: [
    "Hiragino Sans",
    "Hiragino Kaku Gothic ProN",
    "Yu Gothic",
    "Meiryo",
    "sans-serif",
  ],
});

// 見出し用 少し丸みのある温かいゴシック。
const zenMaru = Zen_Maru_Gothic({
  weight: ["500", "700"],
  display: "swap",
  preload: false,
  variable: "--font-rounded",
  fallback: [
    "Hiragino Maru Gothic ProN",
    "Hiragino Sans",
    "Yu Gothic",
    "Meiryo",
    "sans-serif",
  ],
});

export const metadata: Metadata = {
  title: "寺務台帳",
  description: "お寺と檀信徒の関係を 100 年先までつなぐ檀信徒カルテ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${zenKaku.variable} ${zenMaru.variable}`}>
      <head>
        {/* hydration 前に保存済みの文字サイズを適用し、ちらつきを防ぐ */}
        <FontScaleScript />
      </head>
      <body className="font-sans text-base antialiased">{children}</body>
    </html>
  );
}
