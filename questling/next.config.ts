import type { NextConfig } from "next";

const development = process.env.NODE_ENV !== "production";

// Questling runs inside Telegram, which on the web shows a Mini App in a frame:
// the Telegram web clients may frame the site, nobody else may.
// Large media come from the private bucket (lib/server/storage.ts) through signed links: the page may
// load and upload to that origin only. Takes just recorded play from blob: URLs.
const storageOrigin = (() => {
  try {
    return process.env.MEDIA_S3_ENDPOINT ? new URL(process.env.MEDIA_S3_ENDPOINT).origin : "";
  } catch {
    return "";
  }
})();

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js starts pages with inline scripts; Telegram's script is the one outside script allowed.
  `script-src 'self' 'unsafe-inline' https://telegram.org${development ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `media-src 'self' blob:${storageOrigin ? ` ${storageOrigin}` : ""}`,
  `connect-src 'self'${storageOrigin ? ` ${storageOrigin}` : ""}${development ? " ws://localhost:* http://localhost:*" : ""}`,
  "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // next dev would otherwise write an AGENTS.md into the project.
  agentRules: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
