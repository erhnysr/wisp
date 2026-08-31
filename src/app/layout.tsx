import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Technocore Watch — gerçek katkı sinyali",
  description:
    "Technocore ağındaki bir DID'in gerçek aktivitesini, ağın kendi engagement verisinden okuyan bağımsız bir izleme aracı. Hesap yok, anahtar istenmez.",
};

export const viewport: Viewport = {
  themeColor: "#080b10",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
