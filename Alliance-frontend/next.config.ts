import type { NextConfig } from "next";

// The browser talks to the API directly (client components, uploads, PDF
// downloads), so its origin has to be allowed by connect-src. Without this the
// CSP blocks every call the moment the API is on its own domain — which is
// exactly what happens in production.
const originOf = (raw: string | undefined): string => {
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
};

const apiOrigin = originOf(process.env.NEXT_PUBLIC_API_URL);
// Product/category images are served from the object-storage bucket, which is
// a third origin the CSP and the image optimiser both have to know about.
const mediaOrigin = originOf(process.env.NEXT_PUBLIC_MEDIA_URL);
const extraOrigins = [apiOrigin, mediaOrigin].filter(Boolean).join(" ");

const nextConfig: NextConfig = {
  // Single build worker on Windows only: the default parallel worker pool
  // crashes on Windows dev machines with a native STATUS_STACK_BUFFER_OVERRUN
  // fault during "Collecting page data" — reproduced consistently, resolved
  // by forcing one worker. Vercel's Linux build environment doesn't hit this,
  // so it keeps full parallelism.
  ...(process.platform === "win32" ? { experimental: { cpus: 1 } } : {}),
  images: {
    // Category icons and some product images are SVGs uploaded through the
    // admin catalog screen, so this stays on — but an SVG is an executable
    // document, and serving an admin-uploaded one from our own origin is a
    // stored-XSS path. The CSP below neutralises it: no scripts, no fetches,
    // no plugins, evaluated inside a sandbox.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    contentDispositionType: "inline",
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      // The API (uploads served from disk in dev) and the object-storage
      // bucket. Both are runtime config, so an unset one is simply skipped
      // rather than hardcoded to a host this project may not use.
      ...[apiOrigin, mediaOrigin]
        .filter(Boolean)
        .map((origin) => new URL(origin))
        .map(({ protocol, hostname }) => ({
          protocol: protocol.replace(":", "") as "http" | "https",
          hostname,
        })),
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking: nothing in this app is designed to be framed.
          { key: "X-Frame-Options", value: "DENY" },
          // Stops browsers guessing a content type and executing an upload
          // that was meant to be inert.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Quotation IDs travel in URLs; this keeps them out of third-party
          // referrer logs and denies hardware APIs the app never uses.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Two years, preloadable — Vercel terminates TLS, so HSTS is safe
          // here and stops downgrade attempts on the admin login.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // 'unsafe-inline'/'unsafe-eval' on script-src are required by Next's
          // hydration and dev overlay; tightening them needs the nonce-based
          // CSP setup, which is a larger change than this pass. Everything
          // else is locked to same-origin, and frame-ancestors 'none' is the
          // header-level twin of X-Frame-Options.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // 'wasm-unsafe-eval' is required to compile the self-hosted
              // dotLottie renderer (public/lottie/*.wasm) on the login screen;
              // WebAssembly.instantiate is blocked by script-src otherwise,
              // even for a same-origin file.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              `img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://images.unsplash.com https://images.pexels.com${extraOrigins ? ` ${extraOrigins}` : ""}`,
              `connect-src 'self' https://*.public.blob.vercel-storage.com${extraOrigins ? ` ${extraOrigins}` : ""}`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
