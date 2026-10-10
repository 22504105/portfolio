import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { OpeningHours } from "@/components/site/OpeningHours";
import { PriceList } from "@/components/site/PriceList";
import { ArrowLink, ButtonLink } from "@/components/ui/Button";
import { Photo } from "@/components/ui/Photo";
import { BARBER_PORTRAITS } from "@/data/images";
import { Link } from "@/i18n/navigation";
import { getCatalog } from "@/lib/catalog/server";
import { BOOK_HREF } from "@/lib/navigation";
import { pageLocale } from "@/lib/page";

/** How many services the front page shows before sending the visitor to the full list. */
const LIST_PREVIEW = 5;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await pageLocale(params);
  const t = await getTranslations();
  const { shop, services, barbers } = await getCatalog();

  const steps = [
    { title: t("home.how.step1Title"), body: t("home.how.step1Body") },
    { title: t("home.how.step2Title"), body: t("home.how.step2Body") },
    {
      title: t("home.how.step3Title"),
      body: t("home.how.step3Body", {
        holdMinutes: shop.policy.holdMinutes,
        cutoffHours: shop.policy.changeCutoffHours,
      }),
    },
  ];

  return (
    <>
      {/* The headline sits on the dark upper part of the photograph. */}
      <section aria-labelledby="home-title" className="relative isolate">
        <Photo
          image="heroDesktop"
          sizes="(min-width: 48rem) 100vw, 1px"
          priority
          decorative
          className="absolute inset-0 -z-10 max-md:hidden"
        />
        <Photo image="heroMobile" sizes="(min-width: 48rem) 1px, 100vw" priority decorative className="absolute inset-0 -z-10 md:hidden" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-b from-ink/85 via-ink/35 to-ink/90" />

        <Container className="flex min-h-[calc(100svh-var(--spacing-header))] flex-col justify-between gap-16 pb-10 pt-14 md:pb-14 md:pt-20">
          <div>
            <p className="type-eyebrow text-bone/75">{t("home.eyebrow")}</p>
            <h1 id="home-title" className="type-display mt-6 max-w-[14ch]">
              {t("home.headline")}
            </h1>
          </div>

          <div className="grid gap-8 md:grid-cols-12 md:items-end">
            <p className="type-lead md:col-span-6 lg:col-span-5">{t("home.lead")}</p>
            <div className="flex flex-col gap-3 sm:flex-row md:col-span-6 md:justify-end lg:col-span-7">
              <ButtonLink href={BOOK_HREF} variant="signal" size="lg">
                {t("nav.bookAppointment")}
              </ButtonLink>
              <ButtonLink href="/services" variant="outline" size="lg">
                {t("common.allServices")}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      <section data-tone="light" aria-labelledby="list-title" className="bg-bg text-fg">
        <Container className="grid gap-x-8 gap-y-10 py-section md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="type-eyebrow text-muted">{t("home.list.eyebrow")}</p>
            <h2 id="list-title" className="type-h2 mt-5">
              {t("home.list.title")}
            </h2>
            <p className="type-body mt-5 max-w-xs text-muted">{t("home.list.note")}</p>
          </div>
          <div className="md:col-span-7 md:col-start-6">
            <PriceList services={services.slice(0, LIST_PREVIEW)} />
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <ArrowLink href="/services">{t("common.allServices")}</ArrowLink>
              <p className="type-small text-muted">{t("common.pricesNote")}</p>
            </div>
          </div>
        </Container>
      </section>

      <section aria-labelledby="barbers-title">
        <Container className="py-section">
          <div className="grid gap-6 md:grid-cols-12 md:items-end">
            <div className="md:col-span-7">
              <p className="type-eyebrow text-muted">{t("home.barbers.eyebrow")}</p>
              <h2 id="barbers-title" className="type-h1 mt-5 max-w-[16ch]">
                {t("home.barbers.title")}
              </h2>
            </div>
            <p className="type-lead text-muted md:col-span-4 md:col-start-9">{t("home.barbers.lead")}</p>
          </div>

          <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 md:mt-16 lg:grid-cols-4 lg:gap-x-6">
            {barbers.map((barber) => (
              <li key={barber.id}>
                <Link href={{ pathname: "/barbers", hash: barber.slug }} className="group block">
                  <Photo
                    image={BARBER_PORTRAITS[barber.slug]}
                    sizes="(min-width: 64rem) 22vw, 46vw"
                    className="aspect-4/5"
                  />
                  <h3 className="type-h3 mt-4 transition-colors duration-(--duration-fast) group-hover:text-signal">
                    {barber.name}
                  </h3>
                  <p className="type-small mt-1 text-muted">{barber.title[locale]}</p>
                </Link>
              </li>
            ))}
          </ul>

          <ArrowLink href="/barbers" className="mt-12">
            {t("common.meetBarbers")}
          </ArrowLink>
        </Container>
      </section>

      <section aria-labelledby="how-title" className="border-t border-line">
        <Container className="py-section">
          <p className="type-eyebrow text-muted">{t("home.how.eyebrow")}</p>
          <h2 id="how-title" className="type-h2 mt-5">
            {t("home.how.title")}
          </h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((step, index) => (
              <li key={step.title} className="border-t border-line pt-6">
                <p aria-hidden="true" className="type-h2 text-signal tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="type-h3 mt-6">{step.title}</h3>
                <p className="type-body mt-3 max-w-sm text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section data-tone="light" aria-labelledby="visit-title" className="bg-bg text-fg">
        <Container className="grid gap-x-8 gap-y-12 py-section md:grid-cols-12">
          <div className="md:col-span-6">
            <p className="type-eyebrow text-muted">{t("home.visit.eyebrow")}</p>
            <h2 id="visit-title" className="type-h1 mt-5 max-w-[12ch]">
              {t("home.visit.title")}
            </h2>
            <p className="type-lead mt-6 max-w-md text-muted">{t("home.visit.body")}</p>
            <address className="type-body mt-8 not-italic">
              {shop.addressLine1}
              <br />
              {shop.city} {shop.postcode}
            </address>
            <ButtonLink href={BOOK_HREF} variant="solid" size="lg" className="mt-10">
              {t("nav.bookAppointment")}
            </ButtonLink>
          </div>
          <div className="md:col-span-5 md:col-start-8">
            <h3 className="type-eyebrow mb-5 text-muted">{t("common.hours")}</h3>
            <OpeningHours barbers={barbers} />
            <p className="type-small mt-4 text-muted">{t("common.londonTime")}</p>
          </div>
        </Container>
      </section>
    </>
  );
}
