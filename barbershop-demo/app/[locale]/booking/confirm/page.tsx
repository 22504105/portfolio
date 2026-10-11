import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConfirmBooking } from "@/components/booking/ConfirmBooking";
import { Container } from "@/components/layout/Container";
import { pageLocale } from "@/lib/page";

// Reached from an email. The token is in the part of the address after "#",
// which the server never sees; the page is kept out of search engines and
// passes no address on to other sites all the same.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ConfirmPage({ params }: PageProps<"/[locale]/booking/confirm">) {
  await pageLocale(params);
  const t = await getTranslations("booking.confirm");

  return (
    <Container className="py-section">
      <p className="type-eyebrow mb-5 text-muted">{t("eyebrow")}</p>
      <ConfirmBooking />
    </Container>
  );
}
