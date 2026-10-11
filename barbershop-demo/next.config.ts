import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const development = process.env.NODE_ENV !== "production";

// What a page may load and where it may send data. Scripts and styles come
// from the site itself; Next.js needs inline scripts to start a page, and
// its development mode needs eval. Nothing may put the site in a frame, which
// is what stops a hostile page from laying invisible admin buttons under a
// visitor's clicks.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // The browser talks to Supabase Auth only when a session is renewed.
  `connect-src 'self' https://*.supabase.co${development ? " ws://localhost:* http://localhost:*" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Addresses are not passed on to other sites. Pages that receive a secret set a stricter policy themselves.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // "Powered by" tells an attacker what to look up and tells a visitor nothing.
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must be fetched fresh, or an old one could keep serving an old site.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
