import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://build-block.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Build-Block — AI Business Plans",
    template: "%s | Build-Block",
  },
  description:
    "Generate investor-ready business plans in minutes. Powered by proprietary templates and AI.",
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "Build-Block",
    title: "Build-Block — AI Business Plans",
    description:
      "Generate investor-ready business plans in minutes. Powered by proprietary templates and AI.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Build-Block — AI Business Plans",
    description: "Generate investor-ready business plans in minutes.",
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
      <html lang="en">
      <body className="font-sans antialiased bg-surface text-white min-h-screen">
        <Nav />
        {children}
      </body>
    </html>
  );
}
