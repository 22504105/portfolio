import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { THEME_SCRIPT, ThemeKeeper } from "@/components/theme/ThemeToggle";
import { getDictionary, isLocale, LOCALES } from "@/lib/i18n";
import "../globals.css";

// Inter is published under the SIL Open Font License. next/font downloads it
// at build time and serves it from this site, Cyrillic included: no request
// goes to Google when a page is opened.
const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext", "cyrillic"] });

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dictionary = getDictionary(locale);
  return {
    title: { default: `Splitly — ${dictionary.brand.tagline}`, template: "%s · Splitly" },
    description: dictionary.onboarding.lead,
    alternates: { languages: Object.fromEntries(LOCALES.map((option) => [option, `/${option}`])) },
  };
}

export const viewport: Viewport = {
  // Lets the page use the whole screen of a phone, notch and home indicator included; the layout pads for them itself.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f3" },
    { media: "(prefers-color-scheme: dark)", color: "#111a17" },
  ],
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    // The theme is set by a script before the first paint, so the attribute differs from what the server sent.
    <html lang={locale} className={`${inter.variable} antialiased`} suppressHydrationWarning>
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
