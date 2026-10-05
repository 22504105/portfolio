import type { Metadata, Viewport } from "next";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { site } from "@/data/site";
import { displayFont, sansFont } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: `${site.name} — ${site.tagline}`,
  description: `${site.description} ${site.disclosure.long}`,
};

export const viewport: Viewport = {
  themeColor: "#f3f1ec",
};

// Scroll reveals start hidden and are shown by JavaScript; without it they
// must simply be visible.
const NO_SCRIPT_STYLES =
  "[data-reveal]{opacity:1!important;transform:none!important}";

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
