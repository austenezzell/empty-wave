/**
 * Single source of truth for site identity — name, copy, contact and origin.
 *
 * These are the *defaults*. The title and description are overridden at runtime
 * by `manifest.meta`, which the client edits at /admin — see `DEFAULT_META` in
 * lib/slides.ts for where the two meet. Everything else here (services, contact,
 * locality, founder) is compile-time only and has no runtime override.
 *
 * Keeping one copy means a wording change cannot land in the page title but not
 * the share card, or in the description but not the JSON-LD.
 */

/**
 * Public origin of the deployed site.
 *
 * Set `NEXT_PUBLIC_SITE_URL` in the deployed environment. Without it, absolute
 * URLs (share images, canonical, sitemap) are built against localhost and are
 * useless anywhere but this machine.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const SITE = {
  name: "Empty Wave Media",
  description:
    "Photography, print, murals, video, production. Based in Laguna Beach.",
  email: "johnolsonart@gmail.com",
  founder: "John Olson",
  locality: "Laguna Beach",
  region: "CA",
  country: "US",
  services: [
    "Photography",
    "Print",
    "Murals",
    "Video production",
  ],
} as const;
