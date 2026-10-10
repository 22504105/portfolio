import { useTranslations } from "next-intl";
import { Container } from "./Container";

type SiteFooterProps = {
  /** The current year, worked out by the layout when the page is rendered. */
  year: number;
};

export function SiteFooter({ year }: SiteFooterProps) {
  const t = useTranslations();

  return (
    <footer className="border-t border-line">
      <Container className="type-small flex flex-col gap-6 py-10 text-muted md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <p className="text-fg">{t("brand.location")}</p>
          <p>{t("footer.rights", { year })}</p>
          <p>{t("footer.pricesNote")}</p>
        </div>
        {/* CUT&CO is fictional. The disclosure is on every page. */}
        <p className="max-w-md text-fg">{t("brand.conceptLong")}</p>
      </Container>
    </footer>
  );
}
