/**
 * Single source of truth for site identity — name, copy, contact and origin.
 *
 * Everything that describes the site to the outside world reads from here:
 * page metadata, the structured data block, robots.txt, the sitemap and
 * llms.txt. Keeping one copy means a wording change cannot land in the page
 * title but not the share card, or in the description but not the JSON-LD.
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
