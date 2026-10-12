import { ArrowRight, Send } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { LocaleSwitch } from "@/components/shell/LocaleSwitch";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { pageLocale } from "@/lib/page";

// The front door: what Splitly is, and the way into the demo.
export default async function OnboardingPage({ params }: PageProps<"/[locale]">) {
  const { locale, dictionary } = await pageLocale(params);
  const t = dictionary.onboarding;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pt-[env(safe-area-inset-top)] sm:px-6">
      <a
        href="#main"
        className="rounded-control bg-primary text-on-primary fixed top-3 left-3 z-50 -translate-y-24 px-4 py-3 font-semibold transition-transform focus:translate-y-0"
      >
        {dictionary.nav.skip}
      </a>
      <header className="flex h-16 items-center justify-between gap-3 md:h-20">
        <Logo />
        <div className="flex items-center gap-2">
          <LocaleSwitch locale={locale} labels={dictionary.language} />
          <ThemeToggle labels={dictionary.theme} />
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 pb-12 outline-none">
        <section className="grid items-center gap-x-12 gap-y-10 py-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:py-16">
          <div>
            <p className="type-label text-positive">{dictionary.brand.tagline}</p>
            <h1 className="type-display mt-4 text-balance">{t.title}</h1>
            <p className="type-lead text-ink-muted mt-5 max-w-xl">{t.lead}</p>
            <div className="mt-8">
              <Link
                href={`/${locale}/demo`}
                className="rounded-control bg-primary text-on-primary hover:bg-primary-hover inline-flex h-14 w-full items-center justify-center gap-2 px-6 text-[1.0625rem] font-semibold transition-colors sm:w-auto"
              >
                {t.openDemo}
                <ArrowRight aria-hidden="true" className="size-5" />
              </Link>
              <p className="type-small text-ink-muted mt-3">{t.demoHint}</p>
            </div>
          </div>

          {/* Not a button: sign-in does not exist yet, and nothing here pretends that it does. */}
          <aside className="card p-5 sm:p-6">
            <p className="type-heading flex items-center gap-2">
              <span className="bg-accent text-on-accent flex size-9 items-center justify-center rounded-full">
                <Send aria-hidden="true" className="size-4" />
              </span>
              {t.telegram}
            </p>
            <p className="type-small text-ink-muted mt-3">{t.telegramHint}</p>
          </aside>
        </section>

        <ul className="grid gap-4 md:grid-cols-3">
          {t.points.map((point) => (
            <li key={point.title} className="card p-5">
              <h2 className="type-heading">{point.title}</h2>
              <p className="type-small text-ink-muted mt-2">{point.body}</p>
            </li>
          ))}
        </ul>

        <p className="type-small text-ink-muted mt-8 max-w-2xl">{t.limits}</p>
      </main>
    </div>
  );
}
