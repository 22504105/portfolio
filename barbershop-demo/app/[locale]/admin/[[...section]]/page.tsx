import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminApp } from "@/components/admin/AdminApp";
import { AccountsUnavailable } from "@/components/auth/AuthPage";
import { liveSource } from "@/lib/admin/live";
import { accountsAvailable, requireUser } from "@/lib/auth";
import { pageLocale } from "@/lib/page";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

// The real admin. Nothing below this line runs for anyone who is not signed in
// as an admin: everyone else is redirected before any data is read.
export default async function AdminPage({ params, searchParams }: PageProps<"/[locale]/admin/[[...section]]">) {
  const locale = await pageLocale(params);
  if (!accountsAvailable()) {
    const t = await getTranslations("auth");
    return <AccountsUnavailable eyebrow={t("eyebrow")} title={t("unavailableTitle")} body={t("unavailableBody")} />;
  }

  const { section = [] } = await params;
  await requireUser(locale, "/admin", ["admin"]);

  return <AdminApp source={liveSource} base="/admin" locale={locale} segments={section} searchParams={await searchParams} />;
}
