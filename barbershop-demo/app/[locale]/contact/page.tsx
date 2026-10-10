import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { BookingCallout } from "@/components/site/BookingCallout";
import { OpeningHours } from "@/components/site/OpeningHours";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCatalog } from "@/lib/catalog";
import { pageLocale, pageMetadata } from "@/lib/page";

export const generateMetadata = ({ params }: PageProps<"/[locale]/contact">) =>
  pageMetadata(params, "contact", "/contact");

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  await pageLocale(params);
  const t = await getTranslations();
  const { shop, barbers } = await getCatalog();

  // Shown as text, not as tel: and mailto: links: the shop is fictional and
  // the links would lead nowhere.
  const details = [
    { label: t("common.address"), lines: [shop.addressLine1, `${shop.city} ${shop.postcode}`] },
    { label: t("common.phone"), lines: [shop.phone] },
    { label: t("common.email"), lines: [shop.email] },
  ];

  return (
    <>
      <PageHeader eyebrow={t("contact.eyebrow")} title={t("contact.title")} lead={t("contact.lead")} />

      <Container className="grid gap-x-8 gap-y-16 pb-section md:grid-cols-12">
        <div className="md:col-span-6">
          <dl className="border-t border-line">
            {details.map(({ label, lines }) => (
              <div key={label} className="grid gap-2 border-b border-line py-6 sm:grid-cols-[8rem_1fr]">
                <dt className="type-eyebrow pt-2 text-muted">{label}</dt>
                <dd className="type-h3 normal-case">
                  {lines.map((line) => (
                    <span key={line} className="block break-words">
                      {line}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
          <p className="type-small mt-5 max-w-md text-muted">{t("contact.fictionNote")}</p>

          <h2 className="type-h2 mt-16">{t("contact.findTitle")}</h2>
          <p className="type-lead mt-5 max-w-lg text-muted">{t("contact.findBody")}</p>
        </div>

        <div className="md:col-span-5 md:col-start-8">
          <h2 className="type-eyebrow mb-5 text-muted">{t("common.hours")}</h2>
          <OpeningHours barbers={barbers} />
          <p className="type-small mt-4 text-muted">{t("common.londonTime")}</p>
        </div>
      </Container>

      <BookingCallout />
    </>
  );
}
