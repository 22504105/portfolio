import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { openMyBooking } from "@/app/actions/account";
import { signOut, updateProfile } from "@/app/actions/auth";
import { BookingList } from "@/components/account/BookingList";
import { AuthForm, FIELD } from "@/components/auth/AuthForm";
import { AccountsUnavailable } from "@/components/auth/AuthPage";
import { Container } from "@/components/layout/Container";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { listClientBookings } from "@/lib/account";
import { accountsAvailable, requireUser } from "@/lib/auth";
import { BOOK_HREF } from "@/lib/navigation";
import { pageLocale } from "@/lib/page";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  const locale = await pageLocale(params);
  const t = await getTranslations();
  if (!accountsAvailable()) {
    return <AccountsUnavailable eyebrow={t("auth.eyebrow")} title={t("auth.unavailableTitle")} body={t("auth.unavailableBody")} />;
  }

  const user = await requireUser(locale, "/account");
  const bookings = await listClientBookings(user.id);
  const now = new Date();
  const upcoming = bookings.filter((booking) => booking.status === "confirmed" && booking.endsAt > now).reverse();
  const history = bookings.filter((booking) => !upcoming.includes(booking));

  return (
    <Container className="py-section">
      <p className="type-eyebrow text-muted">{t("account.eyebrow")}</p>
      <h1 className="type-h1 mt-5">{t("account.title")}</h1>
      <p className="type-body mt-5 text-muted">{t("account.greeting", { email: user.email })}</p>
      {user.role === "barber" && user.barberId && (
        <ButtonLink href="/barber" variant="solid" size="lg" className="mt-6">
          {t("nav.workspace")}
        </ButtonLink>
      )}
      {user.role === "admin" && (
        <ButtonLink href="/admin" variant="solid" size="lg" className="mt-6">
          {t("nav.admin")}
        </ButtonLink>
      )}

      <div className="mt-12 grid gap-x-8 gap-y-16 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <section aria-labelledby="upcoming-title">
            <h2 id="upcoming-title" className="type-h2 mb-6">
              {t("account.upcoming")}
            </h2>
            <BookingList
              bookings={upcoming}
              empty={t("account.noUpcoming")}
              view="client"
              actions={(booking) => (
                <form action={openMyBooking}>
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <input type="hidden" name="locale" value={locale} />
                  <Button type="submit" variant="outline">
                    {t("account.manage")}
                  </Button>
                </form>
              )}
            />
            <ButtonLink href={BOOK_HREF} variant="signal" size="lg" className="mt-8">
              {t("nav.bookAppointment")}
            </ButtonLink>
          </section>

          <section aria-labelledby="history-title" className="mt-16">
            <h2 id="history-title" className="type-h2 mb-6">
              {t("account.history")}
            </h2>
            <BookingList bookings={history} empty={t("account.noHistory")} view="client" />
          </section>
        </div>

        <aside aria-labelledby="profile-title" className="lg:col-span-4">
          <h2 id="profile-title" className="type-h3">
            {t("account.profileTitle")}
          </h2>
          <p className="type-small mb-8 mt-3 text-muted">{t("account.profileLead")}</p>
          <AuthForm
            action={updateProfile}
            fields={[
              { name: "name", label: t("auth.name"), type: "text", autoComplete: "name", defaultValue: user.name ?? "" },
              { name: "phone", label: t("account.phone"), type: "tel", autoComplete: "tel", defaultValue: user.phone ?? "", required: false },
            ]}
            submit={t("account.save")}
            working={t("auth.working")}
            saved={t("account.saved")}
            errors={{ invalid: t("auth.errors.invalid"), failed: t("auth.errors.failed") }}
          >
            <div>
              <label htmlFor="field-language" className="type-eyebrow block text-muted">
                {t("account.language")}
              </label>
              <select id="field-language" name="language" defaultValue={user.locale} className={`${FIELD} [&>option]:text-ink`}>
                {routing.locales.map((language) => (
                  <option key={language} value={language}>
                    {t(`locale.${language}`)}
                  </option>
                ))}
              </select>
            </div>
          </AuthForm>

          <div className="type-body mt-10 flex flex-col items-start gap-4 border-t border-line pt-6">
            <Link href="/account/password" className="underline underline-offset-4 transition-colors duration-(--duration-fast) hover:text-signal">
              {t("account.changePassword")}
            </Link>
            <form action={signOut}>
              <input type="hidden" name="locale" value={locale} />
              <Button type="submit" variant="outline">
                {t("account.signOut")}
              </Button>
            </form>
          </div>
        </aside>
      </div>
    </Container>
  );
}
