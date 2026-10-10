import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BookingDetails } from "@/components/booking/BookingDetails";
import { ManageBooking } from "@/components/booking/ManageBooking";
import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/Button";
import { getCatalog } from "@/lib/catalog/server";
import { sessionBookingId } from "@/lib/booking/session";
import { bookableDates } from "@/lib/booking/slots";
import { getBookingView } from "@/lib/booking/store";
import { isDatabaseConfigured } from "@/lib/env";
import { BOOK_HREF } from "@/lib/navigation";
import { pageLocale } from "@/lib/page";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function ManagePage({ params, searchParams }: PageProps<"/[locale]/booking/manage">) {
  await pageLocale(params);
  const t = await getTranslations("booking.manage");
  const query = await searchParams;

  const bookingId = isDatabaseConfigured() ? await sessionBookingId() : null;
  const booking = bookingId ? await getBookingView(bookingId) : null;

  // No session, or a link that did not open one: say how to get in, and nothing
  // about whether any booking exists.
  if (!booking) {
    const badLink = first(query.link) === "invalid";
    return (
      <Container className="py-section">
        <p className="type-eyebrow mb-5 text-muted">{t("eyebrow")}</p>
        <h1 className="type-h1 max-w-[16ch]">{t(badLink ? "invalidLinkTitle" : "noSessionTitle")}</h1>
        <p className="type-lead mt-6 max-w-xl text-muted">{t(badLink ? "invalidLinkBody" : "noSessionBody")}</p>
        <ButtonLink href={BOOK_HREF} variant="outline" size="lg" className="mt-10">
          {t("bookAgainLabel")}
        </ButtonLink>
      </Container>
    );
  }

  const { shop } = await getCatalog();
  const over = booking.status === "completed" || booking.status === "no_show" || booking.status === "expired";
  const title =
    booking.status === "confirmed" ? "confirmedTitle"
    : booking.status === "cancelled" ? "cancelledTitle"
    : booking.status === "pending" ? "pendingTitle"
    : "closedTitle";
  const body =
    booking.status === "cancelled" ? "cancelledBody" : booking.status === "pending" ? "pendingBody" : over ? "closedBody" : null;

  return (
    <Container className="py-section">
      <p className="type-eyebrow mb-5 text-muted">{t("eyebrow")}</p>
      <h1 className="type-h1 max-w-[16ch]">{t(title)}</h1>
      {first(query.confirmed) === "1" && booking.status === "confirmed" && (
        <p role="status" className="type-lead mt-6 max-w-xl">
          {t("justConfirmed")}
        </p>
      )}
      {body && <p className="type-lead mt-6 max-w-xl text-muted">{t(body)}</p>}

      <div className="mt-12 grid gap-x-8 gap-y-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <BookingDetails booking={booking} />

          {booking.status === "confirmed" &&
            (booking.changeable ? (
              <ManageBooking
                startsAt={booking.startsAt.toISOString()}
                dates={bookableDates(new Date(), shop.policy.horizonDays)}
                cutoffHours={shop.policy.changeCutoffHours}
              />
            ) : (
              <p className="type-body mt-10 max-w-xl border border-line p-5 text-muted">
                {t("lockedNote", { hours: shop.policy.changeCutoffHours })}
              </p>
            ))}

          {booking.status !== "confirmed" && booking.status !== "pending" && (
            <ButtonLink href={BOOK_HREF} variant="signal" size="lg" className="mt-10">
              {t("bookAgainLabel")}
            </ButtonLink>
          )}
        </div>
      </div>
    </Container>
  );
}
