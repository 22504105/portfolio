import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileScreen } from "@/components/student/profile-screen";
import { demoProfile } from "@/lib/demo/profile";
import { fill, getDictionary, isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/profile">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: fill(t.meta.demoTitle, { page: t.profile.title }) };
}

export default async function DemoProfilePage({ params }: PageProps<"/[locale]/demo/profile">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <ProfileScreen view={demoProfile(locale)} base={`/${locale}/demo`} locale={locale} />;
}
