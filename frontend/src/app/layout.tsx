import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "@/app/globals.css";

// Force dynamic rendering — no ISR cache (prevents stale HTML after deploys)
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "CampusKards - 校园卡牌对战",
  description: "校园主题卡牌策略对战游戏",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
