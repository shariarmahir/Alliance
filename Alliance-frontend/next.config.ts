import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Single build worker on Windows only: the default parallel worker pool
  // crashes on Windows dev machines with a native STATUS_STACK_BUFFER_OVERRUN
  // fault during "Collecting page data" — reproduced consistently, resolved
  // by forcing one worker. Vercel's Linux build environment doesn't hit this,
  // so it keeps full parallelism.
  ...(process.platform === "win32" ? { experimental: { cpus: 1 } } : {}),
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
