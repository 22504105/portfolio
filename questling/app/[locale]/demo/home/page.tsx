import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeScreen } from "@/components/student/home-screen";
import { demoHome } from "@/lib/demo/home";
import { fill, getDictionary, isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/home">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: fill(t.meta.demoTitle, { page: t.home.title }) };
}

export default async function DemoHomePage({ params }: PageProps<"/[locale]/demo/home">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <HomeScreen view={demoHome(locale)} base={`/${locale}/demo`} locale={locale} />;
}
