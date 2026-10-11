import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { LinkButton } from "@/components/ui/link-button";
import { demoOverview } from "@/lib/demo/view";
import { getMessages } from "@/lib/i18n";
import { formatRange } from "@/lib/time";

const container = "mx-auto w-full max-w-[1240px] px-5 md:px-8";

export default function LandingPage() {
  const messages = getMessages();
  const t = messages.landing;
  const { dataset, comparison } = demoOverview();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="rounded-input bg-brand fixed top-4 left-4 z-[60] -translate-y-24 px-4 py-2.5 font-medium text-white transition-transform focus:translate-y-0"
      >
        {messages.nav.skip}
      </a>

      <header className="border-line border-b">
        <div className={`${container} flex h-[72px] items-center justify-between gap-4`}>
          <Link href="/" aria-label={messages.nav.home} className="text-ink inline-flex h-11 items-center">
            <Logo />
          </Link>
          <nav aria-label="Site" className="flex items-center gap-2">
            <LinkButton href="/login" variant="ghost">
              {t.signIn}
            </LinkButton>
            <LinkButton href="/demo" variant="outline" className="max-sm:hidden">
              {t.exploreDemo}
            </LinkButton>
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <section
          className={`${container} grid items-center gap-x-14 gap-y-12 py-14 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-24`}
        >
          <div>
            <p className="type-label text-brand-hover">{messages.brand.tagline}</p>
            <h1 className="type-display mt-5 max-w-[14ch] text-balance">{t.heroTitle}</h1>
            <p className="type-lead text-ink-muted mt-6 max-w-[34rem]">{t.heroBody}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/demo" size="lg">
                {t.exploreDemo}
                <ArrowRight aria-hidden="true" />
              </LinkButton>
              <LinkButton href="/signup" size="lg" variant="outline">
                {t.createWorkspace}
              </LinkButton>
            </div>
          </div>

          {/* Not a picture of the product: the product's own component, on the demo's own figures. */}
          <figure aria-label={t.previewLabel} className="min-w-0">
            <div className="border-line bg-surface-2 shadow-raised rounded-[20px] border p-2.5 sm:p-3.5">
              <div className="border-line bg-canvas rounded-[12px] border p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="type-card">{dataset.workspace.name}</p>
                  <p className="type-meta text-ink-muted tabular-nums">{formatRange(comparison.range)}</p>
                </div>
                <KpiCards comparison={comparison} currency={dataset.workspace.currency} messages={messages} compact />
              </div>
            </div>
            <figcaption className="type-meta text-ink-muted mt-3.5">{t.previewCaption}</figcaption>
          </figure>
        </section>

        <section aria-labelledby="features-title" className="border-line bg-surface border-t">
          <div className={`${container} py-16 md:py-24`}>
            <h2 id="features-title" className="type-section max-w-[22ch] text-balance">
              {t.featuresTitle}
            </h2>
            <ul className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-3">
              {t.features.map((feature, index) => (
                <li key={feature.title} className="border-ink border-t pt-5">
                  <p aria-hidden="true" className="type-meta text-ink-muted tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-3 text-[1.1875rem] font-semibold tracking-[-0.015em]">{feature.title}</h3>
                  <p className="text-ink-muted mt-2.5 text-[0.9375rem] leading-relaxed">{feature.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="steps-title" className="border-line border-t">
          <div className={`${container} py-16 md:py-24`}>
            <h2 id="steps-title" className="type-section max-w-[22ch] text-balance">
              {t.stepsTitle}
            </h2>
            <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {t.steps.map((step, index) => (
                <li key={step.title} className="card p-6">
                  <p
                    aria-hidden="true"
                    className="bg-brand-tint text-brand-hover flex size-9 items-center justify-center rounded-full text-[0.9375rem] font-semibold tabular-nums"
                  >
                    {index + 1}
                  </p>
                  <h3 className="type-card mt-5 text-[1.0625rem]">{step.title}</h3>
                  <p className="text-ink-muted mt-2">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="privacy-title" className="on-nav bg-nav text-nav-ink">
          <div className={`${container} grid gap-x-14 gap-y-8 py-16 md:grid-cols-[auto_1fr] md:py-20`}>
            <ShieldCheck aria-hidden="true" className="size-10 text-[#b9b0ff]" strokeWidth={1.5} />
            <div>
              <h2 id="privacy-title" className="type-section max-w-[24ch] text-balance text-white">
                {t.privacyTitle}
              </h2>
              <p className="type-lead text-nav-ink-muted mt-5 max-w-[44rem]">{t.privacyBody}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <LinkButton href="/demo" size="lg">
                  {t.exploreDemo}
                </LinkButton>
                <LinkButton href="/privacy" size="lg" variant="inverse">
                  {t.privacyLink}
                </LinkButton>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="faq-title" className="border-line bg-surface border-t">
          <div className={`${container} grid gap-x-14 gap-y-8 py-16 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:py-24`}>
            <h2 id="faq-title" className="type-section">
              {t.faqTitle}
            </h2>
            <div className="border-line border-t">
              {t.faq.map((item) => (
                <details key={item.q} className="group border-line border-b">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[1.0625rem] font-medium [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="text-ink-muted text-xl leading-none transition-transform duration-200 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="text-ink-muted max-w-[40rem] pb-5 text-[0.9375rem] leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-line border-t">
        <div className={`${container} flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <Logo className="text-ink" />
            <p className="type-meta text-ink-muted mt-2">{t.footerNote}</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6">
            {(
              [
                ["/demo", t.exploreDemo],
                ["/login", t.signIn],
                ["/privacy", t.privacy],
              ] as const
            ).map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="text-ink-muted hover:text-ink inline-flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
