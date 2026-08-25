/**
 * sitemap.xml.
 *
 * A single-page site, so this is one entry — but it gives crawlers a canonical
 * absolute URL and a last-modified date rather than leaving them to infer both.
 */

import type { MetadataRoute } from "next";

import { getManifest } from "@/lib/media";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Touching the manifest ties the sitemap to the same revalidation as the page.
  await getManifest();

  return [
    {
      url: SITE_URL,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
