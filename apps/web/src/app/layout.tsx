import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
