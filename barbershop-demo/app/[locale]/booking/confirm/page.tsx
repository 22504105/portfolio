import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConfirmBooking } from "@/components/booking/ConfirmBooking";
import { Container } from "@/components/layout/Container";
import { looksLikeToken } from "@/lib/booking/tokens";
import { pageLocale } from "@/lib/page";

// The address of this page carries a secret: it is kept out of search engines
// and is not passed on to other sites in the Referer header.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function ConfirmPage({ params, searchParams }: PageProps<"/[locale]/booking/confirm">) {
  await pageLocale(params);
  const t = await getTranslations("booking.confirm");
  const token = first((await searchParams).token) ?? "";

  return (
    <Container className="py-section">
      <p className="type-eyebrow mb-5 text-muted">{t("eyebrow")}</p>
      <ConfirmBooking token={token} plausible={looksLikeToken(token)} />
    </Container>
  );
}
