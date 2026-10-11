import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/Button";
import { BOOK_HREF } from "@/lib/navigation";

/** The closing section of the inner pages: one sentence and the way to book. */
export function BookingCallout() {
  const t = useTranslations();

  return (
    <section data-tone="light" aria-labelledby="callout-title" className="bg-bg text-fg">
      <Container className="flex flex-col gap-8 py-16 md:flex-row md:items-end md:justify-between md:py-24">
        <div>
          <h2 id="callout-title" className="type-h1 max-w-[14ch]">
            {t("contact.bookTitle")}
          </h2>
          <p className="type-lead mt-5 max-w-md text-muted">{t("contact.bookBody")}</p>
        </div>
        <ButtonLink href={BOOK_HREF} variant="solid" size="lg" className="shrink-0">
          {t("nav.bookAppointment")}
        </ButtonLink>
      </Container>
    </section>
  );
}
