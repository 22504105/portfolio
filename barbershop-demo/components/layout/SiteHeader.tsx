import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { BOOK_HREF } from "@/lib/navigation";
import { Container } from "./Container";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { MobileMenu } from "./MobileMenu";
import { NavLinks } from "./NavLinks";

export function SiteHeader() {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink">
      <Container className="flex h-header items-center justify-between gap-6">
        <Link href="/" aria-label={t("nav.home")} className="font-display text-2xl font-semibold tracking-wide">
          {t("brand.name")}
        </Link>

        <nav aria-label={t("nav.primary")} className="max-lg:hidden">
          <NavLinks
            className="flex items-center gap-1"
            linkClassName="type-label inline-flex h-11 items-center px-3 text-muted transition-colors duration-(--duration-fast) hover:text-fg aria-[current]:text-fg"
          />
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="max-lg:hidden">
            <LocaleSwitcher />
          </div>
          <ButtonLink href={BOOK_HREF} variant="signal" className="max-sm:px-4">
            {t("nav.book")}
          </ButtonLink>
          <MobileMenu />
        </div>
      </Container>
    </header>
  );
}
