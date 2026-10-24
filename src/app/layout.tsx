import type { Metadata, Viewport } from "next";
import { AppNav } from "@/components/app-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "家庭学習タスク",
  description: "SAPIX資料から家庭学習計画を作り、毎日のタスクをチェックする個人用アプリ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full bg-white font-sans text-zinc-900">
        <AppNav />
        <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 md:pb-12">{children}</main>
      </body>
    </html>
  );
}
