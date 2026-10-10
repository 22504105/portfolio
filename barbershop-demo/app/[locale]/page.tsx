import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { routing } from "@/i18n/routing";

// Phase 01 stands up the foundation only. This page shows the tokens and both
// languages at work; the real home page replaces it in Phase 02.
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <>
      <section aria-labelledby="home-title">
        <Container className="pb-section pt-16 md:pt-24">
          <p className="type-eyebrow text-muted">{t("home.eyebrow")}</p>
          <h1 id="home-title" className="type-display mt-6 max-w-[14ch]">
            {t("home.headline")}
          </h1>
          <div className="mt-10 grid gap-8 md:mt-14 md:grid-cols-12">
            <p className="type-lead md:col-span-6 lg:col-span-5">{t("home.lead")}</p>
            <p className="type-h3 text-signal md:col-span-5 md:col-start-8 md:text-right">{t("brand.tagline")}</p>
          </div>
        </Container>
      </section>

      <section data-tone="light" aria-labelledby="foundation-title" className="bg-bg text-fg">
        <Container className="grid gap-6 py-16 md:grid-cols-12 md:py-20">
          <h2 id="foundation-title" className="type-h2 md:col-span-4">
            {t("home.foundationTitle")}
          </h2>
          <p className="type-lead max-w-2xl text-muted md:col-span-7 md:col-start-6">{t("home.foundationBody")}</p>
        </Container>
      </section>
    </>
  );
}
