import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dict, isLang, langs } from "@/lib/i18n";
import { inter, manrope } from "@/lib/fonts";
import "../globals.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return langs.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict[lang].meta;
  return {
    title: { default: t.title, template: `%s · ${t.title}` },
    description: t.description,
    openGraph: { title: t.title, description: t.description, type: "website" },
  };
}

export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang} className={`${inter.variable} ${manrope.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
