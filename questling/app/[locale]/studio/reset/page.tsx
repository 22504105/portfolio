import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AuthScreen } from "@/components/studio/auth-screen";
import { isLocale } from "@/lib/i18n";
import { studioMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = studioMetadata("live", (t) => t.auth.resetTitle);

export default async function Page({ params }: PageProps<"/[locale]/studio/reset">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <Suspense>
      <AuthScreen locale={locale} mode="reset" />
    </Suspense>
  );
}
