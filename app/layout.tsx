/**
 * Root layout. Loads the fonts, declares the site metadata, and keeps the
 * document full-height so the poster can fill the viewport.
 *
 * All outward-facing copy comes from `lib/site.ts` so the page title, share
 * card, structured data and llms.txt cannot drift apart.
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
 * Metadata is read from the manifest so the client can edit the title and
 * description at /admin without a deploy. `getManifest` is cached under the
 * `manifest` tag, so this does not force the page out of static rendering, and
 * saving in the admin revalidates it.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { meta } = await getManifest();

  return {
  // Required for absolute share-image and canonical URLs.
  metadataBase: new URL(SITE_URL),
  title: {
    default: meta.title,
    template: `%s — ${meta.title}`,
  },
  description: meta.description,
  applicationName: meta.title,
  keywords: [
    "photography",
    "print",
    "murals",
    "video production",
    "Laguna Beach",
    "Orange County",
    "California",
    meta.title,
  ],
  authors: [{ name: "John Olson", url: SITE_URL }],
  creator: "John Olson",
  publisher: meta.title,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: meta.title,
    title: meta.title,
    description: meta.description,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: meta.title,
    description: meta.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  category: "Photography",
  // `app/opengraph-image.png`, `app/twitter-image.png` and the icon files are
  // picked up by convention; Next emits those tags and their dimensions itself.
  };
}

export const viewport: Viewport = {
  themeColor: "#e7e5e0",
  // The poster is edge-to-edge, so let it run under the iOS status bar.
  viewportFit: "cover",
};

/**
 * Structured data.
 *
 * The page itself is a wordless poster — the lettering is artwork, not text —
 * so a crawler or an LLM has almost nothing to read. This block is what tells
 * them what the business is, what it offers and where it is.
 */
function buildStructuredData(name: string, description: string) {
  return {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name,
  description,
  url: SITE_URL,
  email: `mailto:${SITE.email}`,
  image: `${SITE_URL}/opengraph-image.png`,
  founder: { "@type": "Person", name: "John Olson" },
  address: {
    "@type": "PostalAddress",
    addressLocality: SITE.locality,
    addressRegion: SITE.region,
    addressCountry: SITE.country,
  },
  areaServed: { "@type": "Place", name: "Laguna Beach, California" },
  knowsAbout: SITE.services,
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Services",
    itemListElement: SITE.services.map((service) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: service },
    })),
  },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { meta } = await getManifest();
  const structuredData = buildStructuredData(meta.title, meta.description);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper">
        <script
          type="application/ld+json"
          // Serialised from a local literal, so there is no untrusted input here.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
