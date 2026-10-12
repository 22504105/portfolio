import type { NextConfig } from "next";

const development = process.env.NODE_ENV !== "production";

// What a page may load, and who may show it. Splitly runs inside Telegram,
// which on the web shows a Mini App in a frame: so the Telegram web clients
// may frame the site, and nobody else may. (X-Frame-Options cannot express
// "these sites only", so frame-ancestors does the job alone.)
const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js starts pages with inline scripts. Telegram's own script is the one outside script allowed:
  // it is how a Mini App learns who opened it, and it is loaded only when Telegram opened the page.
  `script-src 'self' 'unsafe-inline' https://telegram.org${development ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${development ? " ws://localhost:* http://localhost:*" : ""}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The camera is for photographing receipts, on this site only.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
