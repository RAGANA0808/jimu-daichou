import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // 和文優先の標準フォントスタック
        sans: [
          "'Noto Sans JP'",
          "'Hiragino Sans'",
          "'Hiragino Kaku Gothic ProN'",
          "'Yu Gothic'",
          "Meiryo",
          "sans-serif",
        ],
        serif: [
          "'Noto Serif JP'",
          "'Hiragino Mincho ProN'",
          "'Yu Mincho'",
          "serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
