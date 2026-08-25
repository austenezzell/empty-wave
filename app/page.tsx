/**
 * The public site: the poster and nothing else.
 *
 * Rendered on the server so the manifest fetch is cached under the `manifest`
 * tag. Admin edits call `revalidateTag`, so the page updates on the next
 * request without the visitor's browser ever talking to Supabase for anything
 * but the media files themselves.
 */

import { Carousel } from "@/components/carousel";
import { GridOverlay } from "@/components/grid-overlay";
import { getDisplayManifest } from "@/lib/media";
import { SITE, SITE_URL } from "@/lib/site";
import type { SiteMeta } from "@/lib/slides";
import { publicUrl, SUPABASE_URL } from "@/lib/storage-url";

/**
 * Structured data.
 *
 * The page is a wordless poster — the lettering is artwork, not text — so a
 * crawler or an LLM has almost nothing to read. This block is what tells them
 * what the business is, what it offers and where it is.
 *
 * It lives on the page rather than the layout so /admin does not carry a
 * ProfessionalService description no crawler will ever see.
 */
function structuredData(meta: SiteMeta) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: meta.title,
    description: meta.description,
    url: SITE_URL,
    email: `mailto:${SITE.email}`,
    image: `${SITE_URL}/opengraph-image.png`,
    founder: { "@type": "Person", name: SITE.founder },
    address: {
      "@type": "PostalAddress",
      addressLocality: SITE.locality,
      addressRegion: SITE.region,
      addressCountry: SITE.country,
    },
    areaServed: {
      "@type": "Place",
      name: `${SITE.locality}, ${SITE.region}`,
    },
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

export default async function HomePage() {
  const { manifest } = await getDisplayManifest();
  const first = manifest.slides[0];

  return (
    <>
      {/*
        Start the first frame downloading from the HTML itself, rather than
        waiting for the bundle to parse, hydrate and only then ask for it. React
        hoists these into <head>.
      */}
      {SUPABASE_URL && (
        <link rel="preconnect" href={SUPABASE_URL} crossOrigin="anonymous" />
      )}
      {first && (
        <link
          rel="preload"
          // Whichever kind leads the reel: a video first slide is just as much
          // a cold start as an image one.
          as={first.kind === "image" ? "image" : "video"}
          href={publicUrl(first.path)}
          fetchPriority="high"
        />
      )}
      <script
        type="application/ld+json"
        // Serialised from local constants, so there is no untrusted input here.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData(manifest.meta)),
        }}
      />
      <Carousel manifest={manifest} />
      {/* Only renders when the URL carries `?grid`. */}
      <GridOverlay />
    </>
  );
}
