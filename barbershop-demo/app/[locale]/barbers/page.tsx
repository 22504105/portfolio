import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { BookingCallout } from "@/components/site/BookingCallout";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Photo } from "@/components/ui/Photo";
import { BARBER_PORTRAITS } from "@/data/images";
import { getCatalog, workingDays } from "@/lib/catalog";
import { formatWeekdays } from "@/lib/format";
import { BOOK_HREF } from "@/lib/navigation";
import { pageLocale, pageMetadata } from "@/lib/page";

export const generateMetadata = ({ params }: PageProps<"/[locale]/barbers">) =>
  pageMetadata(params, "barbers", "/barbers");

export default async function BarbersPage({ params }: PageProps<"/[locale]/barbers">) {
  const locale = await pageLocale(params);
  const t = await getTranslations("barbers");
  const { services, barbers } = await getCatalog();

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />

      <Container className="pb-section">
        <ul>
          {barbers.map((barber, index) => (
            <li
              key={barber.id}
              id={barber.slug}
              className="grid scroll-mt-(--spacing-header) gap-x-8 gap-y-8 border-t border-line py-12 md:grid-cols-12 md:py-20"
            >
              {/* Portraits alternate sides down the page. */}
              <Photo
                image={BARBER_PORTRAITS[barber.slug]}
                sizes="(min-width: 48rem) 40vw, 100vw"
                className={`aspect-4/5 md:col-span-5 ${index % 2 === 1 ? "md:order-last md:col-start-8" : ""}`}
              />

              <div className={`flex flex-col md:col-span-6 ${index % 2 === 1 ? "md:col-start-1" : "md:col-start-7"}`}>
                <p className="type-eyebrow text-signal">{barber.title[locale]}</p>
                <h2 className="type-h1 mt-4">{barber.name}</h2>
                <p className="type-lead mt-6 max-w-lg text-muted">{barber.bio[locale]}</p>

                <dl className="type-body mt-10 border-t border-line">
                  <div className="grid gap-2 border-b border-line py-4 sm:grid-cols-[8rem_1fr]">
                    <dt className="type-eyebrow pt-1 text-muted">{t("does")}</dt>
                    <dd>
                      {services
                        .filter((service) => barber.serviceIds.includes(service.id))
                        .map((service) => service.name[locale])
                        .join(" · ")}
                    </dd>
                  </div>
                  <div className="grid gap-2 border-b border-line py-4 sm:grid-cols-[8rem_1fr]">
                    <dt className="type-eyebrow pt-1 text-muted">{t("days")}</dt>
                    <dd>{formatWeekdays(workingDays(barber), locale)}</dd>
                  </div>
                </dl>

                <ButtonLink
                  href={{ pathname: BOOK_HREF, query: { barber: barber.slug } }}
                  variant="outline"
                  className="mt-10 self-start"
                >
                  {t("bookWith", { name: barber.name.split(" ")[0] })}
                </ButtonLink>
              </div>
            </li>
          ))}
        </ul>
      </Container>

      <BookingCallout />
    </>
  );
}
