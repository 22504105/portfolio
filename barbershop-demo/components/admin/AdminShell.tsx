import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";
import { SECTIONS, sectionPath, type Section } from "./parts";

type AdminShellProps = {
  base: "/admin" | "/demo/admin";
  section: Section;
  children: ReactNode;
};

/** The frame of every admin page: where you are, the sections, and, in the demo, what you are looking at. */
export function AdminShell({ base, section, children }: AdminShellProps) {
  const t = useTranslations("admin");
  const demo = base === "/demo/admin";

  return (
    <Container className="pb-section pt-10 md:pt-14">
      {demo && (
        // On every page of the demo, above everything else.
        <p className="type-body mb-8 flex items-baseline gap-3 border border-signal p-4">
          <span aria-hidden="true" className="size-2 shrink-0 bg-signal" />
          {t("demoBanner")}
        </p>
      )}
      <p className="type-eyebrow text-muted">{t(demo ? "demoEyebrow" : "eyebrow")}</p>

      <nav aria-label={t("nav.label")} className="-mx-gutter mt-5 overflow-x-auto border-b border-line px-gutter">
        <ul className="flex gap-1">
          {SECTIONS.map((item) => (
            <li key={item} className="shrink-0">
              <Link
                href={`${base}${sectionPath(item)}`}
                aria-current={item === section ? "page" : undefined}
                className="type-label inline-flex h-12 items-center border-b-2 border-transparent px-3 text-muted transition-colors duration-(--duration-fast) hover:text-fg aria-[current]:border-signal aria-[current]:text-fg"
              >
                {t(`nav.${item}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10">{children}</div>
    </Container>
  );
}
