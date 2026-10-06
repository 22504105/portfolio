import type { Metadata, Viewport } from "next";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { site } from "@/data/site";
import { displayFont, sansFont } from "./fonts";
import "./globals.css";

const title = `${site.name} — ${site.tagline}`;
// The disclosure travels with every preview of the page: NOVA is fictional.
const description = `${site.description} ${site.disclosure.long}`;

// The sharing image is app/opengraph-image.jpg. On Vercel its absolute URL is
// resolved from the deployment, so no metadataBase or environment variable is needed.
export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    type: "website",
    siteName: site.name,
    title,
    description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#f3f1ec",
};

// Scroll reveals start hidden and are shown by JavaScript; without it they
// must simply be visible.
const NO_SCRIPT_STYLES =
  "[data-reveal]{opacity:1!important;transform:none!important;clip-path:none!important}";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${displayFont.variable} ${sansFont.variable}`}>
      <body className="type-body min-h-dvh bg-bg text-ink">
        <noscript>
          <style>{NO_SCRIPT_STYLES}</style>
        </noscript>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
