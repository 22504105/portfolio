import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SettingsScreen } from "@/components/student/settings-screen";
import { demoProfile } from "@/lib/demo/profile";
import { fill, getDictionary, isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/settings">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: fill(t.meta.demoTitle, { page: t.settings.title }) };
}

export default async function DemoSettingsPage({ params }: PageProps<"/[locale]/demo/settings">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SettingsScreen locale={locale} base={`/${locale}/demo`} path="/demo/settings" telegram={demoProfile(locale).telegram} />;
}
