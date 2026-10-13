import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { LocaleSwitch } from "@/components/shell/LocaleSwitch";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { pageLocale } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  return { title: (await pageLocale(params)).dictionary.privacy.link };
}

// What is kept and what is not, in plain words. docs/security.md says the same at length.
export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale, dictionary } = await pageLocale(params);
  const t = dictionary.privacy;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pt-[env(safe-area-inset-top)] sm:px-6">
      <header className="flex h-16 items-center justify-between gap-3 md:h-20">
        <Link href={`/${locale}`} aria-label={dictionary.nav.toHome} className="inline-flex h-11 items-center">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <LocaleSwitch locale={locale} labels={dictionary.language} />
          <ThemeToggle labels={dictionary.theme} />
        </div>
      </header>
      <main id="main" className="flex-1 pb-12">
        <h1 className="type-title mt-4 text-balance">{t.title}</h1>
        <p className="type-lead text-ink-muted mt-3">{t.lead}</p>
        <div className="mt-6 flex flex-col gap-3">
          {t.sections.map((section) => (
            <section key={section.title} className="card p-5">
              <h2 className="type-heading">{section.title}</h2>
              <p className="text-ink-muted mt-2">{section.body}</p>
            </section>
          ))}
        </div>
        <Link
          href={`/${locale}`}
          className="type-small text-ink mt-8 inline-flex h-11 items-center gap-1.5 font-semibold underline underline-offset-4"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t.back}
        </Link>
      </main>
    </div>
  );
}
