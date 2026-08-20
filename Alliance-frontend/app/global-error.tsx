"use client";

import { useEffect } from "react";

// Last-resort boundary: only fires if the root layout itself throws, which
// the (site) and admin error.tsx files above can't catch since both render
// inside that layout. Must render its own <html>/<body> — it replaces the
// root layout when active.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#ffffff",
          color: "#0f172a",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            AutoLink is temporarily unavailable
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#475569", marginBottom: 20 }}>
            Something went wrong loading the site. Please try again shortly, or contact{" "}
            <a href="mailto:info@auto-bd.com" style={{ color: "#007DCC" }}>
              info@auto-bd.com
            </a>
            .
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "10px 20px",
              borderRadius: 6,
              background: "#007DCC",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
