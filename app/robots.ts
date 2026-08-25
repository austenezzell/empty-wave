/**
 * robots.txt.
 *
 * The poster is meant to be indexed; /admin and the cron endpoint are not.
 * Disallow is a crawling hint, not access control — /admin is protected by the
 * password gate in `lib/auth.ts`, which is what actually keeps it private.
 */

import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
