import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminApp } from "@/components/admin/AdminApp";
import { createDemoSource } from "@/lib/admin/demo";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/admin/[[...section]]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale === "ru" ? "ru" : "en", namespace: "admin" });
  return { title: t("demoIntroTitle"), robots: { index: false, follow: false } };
}

// The public demo of the admin workspace: open to everyone, on purpose. It is
// given the demo source and nothing else. That source is invented data built
// in memory and marked read-only, so the shared pages render no form and ask
// the database nothing. The admin actions exist in the same application, and
// each of them refuses anyone who is not signed in as an admin: a visitor to
// the demo cannot change anything by posting to them either.
export default async function DemoAdminPage({ params, searchParams }: PageProps<"/[locale]/demo/admin/[[...section]]">) {
  const locale = await pageLocale(params);
  const { section = [] } = await params;

  return <AdminApp source={createDemoSource()} base="/demo/admin" locale={locale} segments={section} searchParams={await searchParams} />;
}
