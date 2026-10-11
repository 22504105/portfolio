import type { MetadataRoute } from "next";

// What a phone needs to install the site as an application. One manifest for
// both languages: the start address has no language in it, and the visitor is
// sent to the one they chose last.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CUT&CO — Barbershop",
    short_name: "CUT&CO",
    description: "Book a chair at CUT&CO. A concept portfolio project, not a real barbershop.",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0c0b",
    theme_color: "#0c0c0b",
    lang: "en",
    categories: ["lifestyle", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Book an appointment", short_name: "Book", url: "/en/book" },
      { name: "Записаться", short_name: "Запись", url: "/ru/book" },
    ],
  };
}
