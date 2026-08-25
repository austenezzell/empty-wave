/**
 * sitemap.xml.
 *
 * A single-page site, so this is one entry, and it holds nothing derived from
 * the manifest — hence no manifest read and no reason to be dynamic.
 */

import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
