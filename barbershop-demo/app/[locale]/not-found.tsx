import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <Container className="py-section">
      <h1 className="type-h1">{t("title")}</h1>
      <p className="type-lead mt-6 text-muted">{t("body")}</p>
      <Link
        href="/"
        className="type-label mt-10 inline-flex h-12 items-center border border-fg px-6 transition-colors duration-(--duration-fast) hover:bg-fg hover:text-bg"
      >
        {t("back")}
      </Link>
    </Container>
  );
}
