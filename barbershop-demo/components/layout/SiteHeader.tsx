import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Container } from "./Container";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function SiteHeader() {
  const t = useTranslations();

  return (
    <header className="border-b border-line">
      <Container className="flex h-header items-center justify-between gap-6">
        <Link href="/" aria-label={t("nav.home")} className="font-display text-2xl font-semibold tracking-wide">
          {t("brand.name")}
        </Link>
        <div className="flex items-center gap-4">
          <p className="type-eyebrow text-muted max-sm:hidden">{t("brand.conceptShort")}</p>
          <LocaleSwitcher />
        </div>
      </Container>
    </header>
  );
}
