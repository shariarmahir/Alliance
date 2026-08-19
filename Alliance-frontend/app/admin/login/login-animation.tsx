"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { DotLottie } from "@lottiefiles/dotlottie-web";

// Both the renderer WASM and the animation file are served from our own
// origin rather than cdn.jsdelivr.net / unpkg.com / lottie.host. The library
// defaults to fetching its WASM from a CDN, which the app's Content-Security-
// Policy (connect-src 'self') blocks — that produced the "Primary WASM URL
// failed / Backup WASM URL failed / Buffered fallback failed" console errors
// on the login screen. Self-hosting keeps the CSP tight and takes a
// third-party runtime dependency off the admin login path.
//
// Must run before any player instance is constructed, hence module scope.
DotLottie.setWasmUrl("/lottie/dotlottie-player.wasm");

export function LoginAnimation() {
  return (
    <div className="w-full max-w-sm">
      <DotLottieReact src="/lottie/login.lottie" loop autoplay />
    </div>
  );
}
