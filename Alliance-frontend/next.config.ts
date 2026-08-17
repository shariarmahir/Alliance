import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Single build worker: the default parallel worker pool crashes on this
  // Windows dev machine with a native STATUS_STACK_BUFFER_OVERRUN fault during
  // "Collecting page data" — reproduced consistently, resolved by forcing one
  // worker. Vercel's Linux build environment does not hit this.
  experimental: {
    cpus: 1,
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
};

export default nextConfig;
