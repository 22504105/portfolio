import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { closeAppointment } from "@/app/actions/account";
import { signOut } from "@/app/actions/auth";
import { BookingList } from "@/components/account/BookingList";
import { Container } from "@/components/layout/Container";
import { ArrowLink, Button } from "@/components/ui/Button";
import { listAwaitingOutcome, listBarberBookings } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { addDays, businessDate, zonedInstant } from "@/lib/business-time";
import { pageLocale } from "@/lib/page";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function BarberPage({ params }: PageProps<"/[locale]/barber">) {
  const locale = await pageLocale(params);
  const t = await getTranslations();
  const user = await requireUser(locale, "/barber", ["barber"]);

  if (!user.barberId) {
    return (
      <Container className="py-section">
        <p className="type-eyebrow text-muted">{t("barber.eyebrow")}</p>
        <p className="type-lead mt-6 max-w-xl">{t("barber.noProfile")}</p>
      </Container>
    );
  }

  // Days are the shop's days, whatever the clock of the server or the barber's phone says.
  const today = businessDate(new Date());
  const startOfToday = zonedInstant(today, "00:00");
  const startOfTomorrow = zonedInstant(addDays(today, 1), "00:00");
  const [awaiting, todays, coming] = await Promise.all([
    listAwaitingOutcome(user.id, user.barberId),
    listBarberBookings(user.id, user.barberId, startOfToday, startOfTomorrow),
    listBarberBookings(user.id, user.barberId, startOfTomorrow, zonedInstant(addDays(today, 8), "00:00")),
  ]);
  const awaitingIds = new Set(awaiting.map((booking) => booking.id));

  const outcome = (bookingId: string) => (
    <form action={closeAppointment} className="flex flex-wrap gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <Button type="submit" name="outcome" value="completed" variant="solid">
        {t("barber.completed")}
      </Button>
      <Button type="submit" name="outcome" value="no_show" variant="outline">
        {t("barber.noShow")}
      </Button>
    </form>
  );

  return (
    <Container className="py-section">
      <p className="type-eyebrow text-muted">{t("barber.eyebrow")}</p>
      <h1 className="type-h1 mt-5">{t("barber.title")}</h1>
      <p className="type-body mt-5 text-muted">{t("account.greeting", { email: user.email })}</p>

      {awaiting.length > 0 && (
        <section aria-labelledby="awaiting-title" className="mt-12 border border-signal p-5 md:p-8">
          <h2 id="awaiting-title" className="type-h2">
            {t("barber.needsOutcome")}
          </h2>
          <p className="type-body mb-6 mt-3 text-muted">{t("barber.needsOutcomeLead")}</p>
          <BookingList bookings={awaiting} empty="" view="barber" actions={(booking) => outcome(booking.id)} />
        </section>
      )}

      <section aria-labelledby="today-title" className="mt-14">
        <h2 id="today-title" className="type-h2 mb-6">
          {t("barber.today")}
        </h2>
        {/* Today's appointments that are already over are listed above, with their buttons. */}
        <BookingList bookings={todays.filter((booking) => !awaitingIds.has(booking.id))} empty={t("barber.nothingToday")} view="barber" />
      </section>

      <section aria-labelledby="coming-title" className="mt-14">
        <h2 id="coming-title" className="type-h2 mb-6">
          {t("barber.upcoming")}
        </h2>
        <BookingList bookings={coming} empty={t("barber.nothingUpcoming")} view="barber" />
      </section>

      <div className="mt-14 flex flex-col items-start gap-6 border-t border-line pt-8">
        <ArrowLink href="/barber/calendar">{t("barber.toCalendar")}</ArrowLink>
        <form action={signOut}>
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant="outline">
            {t("account.signOut")}
          </Button>
        </form>
      </div>
    </Container>
  );
}
