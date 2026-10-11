import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { BookingCallout } from "@/components/site/BookingCallout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Photo } from "@/components/ui/Photo";
import { pageLocale, pageMetadata } from "@/lib/page";

export const generateMetadata = ({ params }: PageProps<"/[locale]/about">) => pageMetadata(params, "about", "/about");

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  await pageLocale(params);
  const t = await getTranslations("about");

  const principles = [
    { title: t("principle1Title"), body: t("principle1Body") },
    { title: t("principle2Title"), body: t("principle2Body") },
    { title: t("principle3Title"), body: t("principle3Body") },
  ];

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />

      <Container className="pb-section">
        <Photo image="team" sizes="(min-width: 90rem) 84rem, 100vw" className="aspect-3/2 md:aspect-21/9" />
      </Container>

      <section aria-labelledby="story-title" className="border-t border-line">
        <Container className="grid gap-x-8 gap-y-8 py-section md:grid-cols-12">
          <h2 id="story-title" className="type-h2 md:col-span-4">
            {t("storyTitle")}
          </h2>
          <div className="type-lead space-y-6 md:col-span-7 md:col-start-6">
            <p>{t("story1")}</p>
            <p className="text-muted">{t("story2")}</p>
            <p className="text-muted">{t("story3")}</p>
          </div>
        </Container>
      </section>

      <section data-tone="light" aria-labelledby="principles-title" className="bg-bg text-fg">
        <Container className="py-section">
          <h2 id="principles-title" className="type-h2">
            {t("principlesTitle")}
          </h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {principles.map((principle, index) => (
              <li key={principle.title} className="border-t border-line pt-6">
                <p aria-hidden="true" className="type-eyebrow text-muted tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="type-h1 mt-6">{principle.title}</h3>
                <p className="type-body mt-4 max-w-sm text-muted">{principle.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* CUT&CO is fictional, and this is the page where a visitor looks for who is behind it. */}
      <section aria-labelledby="concept-title">
        <Container className="grid gap-x-8 gap-y-6 py-section md:grid-cols-12">
          <h2 id="concept-title" className="type-h2 text-signal md:col-span-4">
            {t("conceptTitle")}
          </h2>
          <p className="type-lead md:col-span-7 md:col-start-6">{t("conceptBody")}</p>
        </Container>
      </section>

      <BookingCallout />
    </>
  );
}
