import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeKeeper } from "@/components/theme/ThemeToggle";
import { THEME_SCRIPT } from "@/components/theme/theme-script";
import { defaultLocale, getMessages } from "@/lib/i18n";
import "./globals.css";

// Geist is published under the SIL Open Font License. next/font downloads it
// at build time and serves it from this site: no request goes to Google.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const messages = getMessages();

export const metadata: Metadata = {
  title: { default: `Flowly — ${messages.brand.tagline}`, template: "%s · Flowly" },
  description: messages.landing.heroBody,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#171a20" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f12" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme is set by a script before the first paint, so the attribute differs from what the server sent.
    <html lang={defaultLocale} className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ThemeKeeper />
        {children}
      </body>
    </html>
  );
}
