import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "Your Factory - メカニック・車両整備・パーツクラフト管理システム",
  description: "Your Factory メカニック業務管理・リアルタイムパーツ在庫・売上伝票・整備士ボーナス管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased selection:bg-rose-500 selection:text-white">
        <AppProvider>
          <ClientLayout>{children}</ClientLayout>
        </AppProvider>
      </body>
    </html>
  );
}
