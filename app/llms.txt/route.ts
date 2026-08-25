/**
 * /llms.txt — a plain-text summary for language models.
 *
 * This matters more here than on a typical site: the page is a wordless poster
 * whose only "text" is hand-lettered artwork inside SVGs. A model fetching the
 * HTML finds almost nothing readable. This states plainly what the business is,
 * what it offers and how to reach it.
 *
 * Served from a route handler rather than a static file so it stays in step
 * with the title and description the client edits at /admin.
 */

import { getManifest } from "@/lib/media";
import { SITE, SITE_URL } from "@/lib/site";

export async function GET() {
  const { meta } = await getManifest();

  const body = `# ${meta.title}

> ${meta.description}

${SITE.locality}, ${SITE.region}, ${SITE.country}.

## Services

${SITE.services.map((s) => `- ${s}`).join("\n")}

## Contact

- Email: ${SITE.email}

## About this site

${SITE_URL} is a single page: a full-screen reel of photography and video on a
warm off-white ground, with the studio's hand-lettered logotype set beneath it.
The wordmark, services line, email and colophon are artwork (SVG), not selectable
text, so this file — and the JSON-LD block in the page head — carry the readable
description of the studio.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
