import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const viewport: Viewport = { themeColor: "#171a20" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={defaultLocale} className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
