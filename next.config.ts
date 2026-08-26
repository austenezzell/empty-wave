// Next.js configuration.

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * sharp is a native module and must not be bundled. It decodes the AVIF
   * slides for the generated share image — see app/opengraph-image.tsx.
   */
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
