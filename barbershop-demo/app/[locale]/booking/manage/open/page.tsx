import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OpenBooking } from "@/components/booking/OpenBooking";
import { Container } from "@/components/layout/Container";
import { pageLocale } from "@/lib/page";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function OpenBookingPage({ params }: PageProps<"/[locale]/booking/manage/open">) {
  await pageLocale(params);
  const t = await getTranslations("booking.manage");

  return (
    <Container className="py-section">
      <p className="type-eyebrow mb-5 text-muted">{t("eyebrow")}</p>
      <OpenBooking />
    </Container>
  );
}
