/**
 * Root layout. Loads the fonts, sets the document metadata, and keeps the
 * document full-height so the carousel can fill the viewport.
 */

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  /*
   * Required for absolute share-image URLs. Without it Next falls back to
   * localhost and the preview breaks everywhere off this machine.
   */
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Empty Wave Media",
  description:
    "Photography, print, murals and video production. Laguna Beach, CA.",
  openGraph: {
    title: "Empty Wave Media",
    description:
      "Photography, print, murals and video production. Laguna Beach, CA.",
    type: "website",
  },
  // `app/opengraph-image.png` and `app/twitter-image.png` are picked up by
  // convention; Next emits the tags and dimensions itself.
};

export const viewport: Viewport = {
  themeColor: "#e7e5e0",
  // The carousel is edge-to-edge, so let it run under the iOS status bar.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper">{children}</body>
    </html>
  );
}
