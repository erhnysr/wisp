import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CursorGlow } from "@/components/CursorGlow";

export const metadata: Metadata = {
  title: "Technocore Watch — real contribution signal",
  description:
    "An independent tool that reads a Technocore DID's real activity from the network's own engagement data. No account, no key, ever.",
};

export const viewport: Viewport = {
  themeColor: "#f7f8fc",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <CursorGlow />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
