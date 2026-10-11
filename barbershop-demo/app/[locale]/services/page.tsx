import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { BookingCallout } from "@/components/site/BookingCallout";
import { PriceList } from "@/components/site/PriceList";
import { PageHeader } from "@/components/ui/PageHeader";
import { Photo } from "@/components/ui/Photo";
import { getCatalog } from "@/lib/catalog/server";
import { pageLocale, pageMetadata } from "@/lib/page";

export const generateMetadata = ({ params }: PageProps<"/[locale]/services">) =>
  pageMetadata(params, "services", "/services");

export default async function ServicesPage({ params }: PageProps<"/[locale]/services">) {
  await pageLocale(params);
  const t = await getTranslations("services");
  const { services } = await getCatalog();

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />

      <Container className="pb-section">
        <PriceList services={services} detailed />
      </Container>

      <section aria-labelledby="notes-title" className="border-t border-line">
        <Container className="grid gap-x-8 gap-y-10 py-section md:grid-cols-12 md:items-center">
          <Photo image="clippers" sizes="(min-width: 48rem) 50vw, 100vw" className="aspect-3/2 md:col-span-6" />
          <div className="md:col-span-5 md:col-start-8">
            <h2 id="notes-title" className="type-h2">
              {t("notesTitle")}
            </h2>
            <ul className="type-body mt-8 border-t border-line text-muted">
              {[t("note1"), t("note2"), t("note3")].map((note) => (
                <li key={note} className="border-b border-line py-4">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <BookingCallout />
    </>
  );
}
