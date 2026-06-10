import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Build-Block — AI Business Plans",
  description: "Generate investor-ready business plans powered by proprietary templates and AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-surface text-white">{children}</body>
    </html>
  );
}
