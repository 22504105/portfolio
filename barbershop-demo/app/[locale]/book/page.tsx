import { getTranslations } from "next-intl/server";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { Container } from "@/components/layout/Container";
import { getSessionUser } from "@/lib/auth";
import { getCatalog } from "@/lib/catalog/server";
import { isDatabaseConfigured } from "@/lib/env";
import { pageLocale, pageMetadata } from "@/lib/page";

export const generateMetadata = ({ params }: PageProps<"/[locale]/book">) => pageMetadata(params, "book", "/book");

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function BookPage({ params, searchParams }: PageProps<"/[locale]/book">) {
  await pageLocale(params);
  const t = await getTranslations("booking");
  const catalog = await getCatalog();
  const live = isDatabaseConfigured();
  const user = await getSessionUser();

  // Links from the price list and the barbers' page name a service or a barber
  // by slug. Anything unknown is simply ignored.
  const query = await searchParams;
  const preselection = {
    serviceId: catalog.services.find((service) => service.slug === first(query.service))?.id,
    barberId: catalog.barbers.find((barber) => barber.slug === first(query.barber))?.id,
    // A signed-in client does not type their details again. They can still change them.
    contact: user ? { name: user.name ?? "", email: user.email, phone: user.phone ?? "" } : undefined,
  };

  return (
    <Container className="pb-section pt-10 md:pt-16">
      <p className="type-eyebrow text-muted">{t("eyebrow")}</p>
      <h1 className="type-h2 mt-4">{t("title")}</h1>
      {!live && (
        // No database is configured: the flow runs on a mock, and says so.
        <p className="type-small mt-6 flex max-w-2xl items-baseline gap-3 border border-line p-4 text-muted">
          <span aria-hidden="true" className="size-2 shrink-0 bg-signal" />
          {t("demoNotice")}
        </p>
      )}

      <div className="mt-10 md:mt-14">
        <BookingWizard catalog={catalog} preselection={preselection} live={live} />
      </div>
    </Container>
  );
}
