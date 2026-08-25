/**
 * Root layout. Loads the fonts, declares the site metadata, and keeps the
 * document full-height so the poster can fill the viewport.
 *
 * Title and description come from `manifest.meta`, which the client edits at
 * /admin; everything else comes from `lib/site.ts`. Next fills `openGraph` and
 * `twitter` title/description from the top-level fields automatically, so they
 * are deliberately not restated here.
 */

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { getManifest } from "@/lib/media";
import { SITE, SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Read from the manifest so the client can retitle the site without a deploy.
 * `getManifest` is cached under the `manifest` tag, so this does not force the
 * page out of static rendering, and saving in the admin revalidates it.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { meta } = await getManifest();

  return {
    // Required for absolute share-image and canonical URLs.
    metadataBase: new URL(SITE_URL),
    title: { default: meta.title, template: `%s — ${meta.title}` },
    description: meta.description,
    applicationName: meta.title,
    keywords: [
      ...SITE.services,
      SITE.locality,
      "Orange County",
      "California",
      meta.title,
    ],
    authors: [{ name: SITE.founder, url: SITE_URL }],
    creator: SITE.founder,
    publisher: meta.title,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: meta.title,
      url: SITE_URL,
      locale: "en_US",
    },
    twitter: { card: "summary_large_image" },
    robots: {
      index: true,
      follow: true,
      googleBot: { "max-image-preview": "large" },
    },
    category: SITE.services[0],
    // `app/opengraph-image.png`, `app/twitter-image.png` and the icon files are
    // picked up by convention; Next emits those tags and their dimensions itself.
  };
}

export const viewport: Viewport = {
  themeColor: "#e7e5e0",
  // The poster is edge-to-edge, so let it run under the iOS status bar.
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
