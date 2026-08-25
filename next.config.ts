// Next.js configuration.

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /*
     * The carousel itself uses plain <img>, deliberately — these are arbitrary
     * client uploads and optimising every one would bill a transform per photo.
     *
     * This entry exists for the share image only: Satori cannot decode AVIF, so
     * `app/opengraph-image.tsx` routes each slide through the optimiser, which
     * returns a format it can read.
     */
    remotePatterns: [{ protocol: "https", hostname: "xostvqqhavpgrddvupzw.supabase.co" }],
  },
};

export default nextConfig;
