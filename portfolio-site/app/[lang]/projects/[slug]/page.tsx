import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactSection, Chips, ExternalLink, Footer, Header, Icon, Shot, container } from "@/components/ui";
import { caseStudy } from "@/lib/content";
import { dict, isLang, langs, localizeDemo } from "@/lib/i18n";
import { codeUrl, getProject, projects } from "@/lib/projects";

export const dynamicParams = false;

export function generateStaticParams() {
  return langs.flatMap((lang) => projects.map((p) => ({ lang, slug: p.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/projects/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const p = getProject(slug);
  if (!p || !isLang(lang)) return {};
  return { title: p.name, description: p.tagline[lang] };
}

export default async function ProjectPage({ params }: PageProps<"/[lang]/projects/[slug]">) {
  const { lang, slug } = await params;
  const p = getProject(slug);
  if (!p || !isLang(lang)) notFound();
  const t = dict[lang];
  const sections = await caseStudy(p.showcase, lang);
  const other = lang === "en" ? "ru" : "en";
  const next = projects[(projects.indexOf(p) + 1) % projects.length];
  const desktop = p.shots.filter((s) => s.kind === "desktop");
  const phones = p.shots.filter((s) => s.kind === "phone");

  return (
    // A plain wrapper, not a fragment: after a link Next.js scrolls to the page's first element only when it is
    // off screen, and the sticky header never is, so the next page opened where the last one was scrolled to.
    <div>
      <Header lang={lang} alternate={`/${other}/projects/${p.slug}/`} />
      <main id="main">
        <div className={`${container} pt-8 sm:pt-12`}>
          <Link href={`/${lang}/#projects`} className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
            <Icon name="arrow" className="size-4 rotate-180" />
            {t.detail.back}
          </Link>
          <p className="mt-6 text-sm font-semibold text-accent">{p.kind[lang]}</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{p.name}</h1>
          <p className="mt-4 max-w-3xl font-display text-xl font-semibold text-pretty sm:text-2xl">{p.headline[lang]}</p>
          <p className="mt-3 max-w-3xl text-lg text-pretty text-muted">{p.tagline[lang]}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {p.links.map((l, i) => (
              <ExternalLink
                key={l.href}
                href={localizeDemo(l.href, lang)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${i === 0 ? "bg-accent text-on-accent hover:bg-accent-hover" : "border border-line bg-surface hover:border-accent hover:text-accent"}`}
              >
                {l.label[lang]}
                <Icon name="external" />
              </ExternalLink>
            ))}
            <ExternalLink href={codeUrl(p)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent">
              <Icon name="github" />
              {t.detail.code}
            </ExternalLink>
          </div>
          <p className="mt-4 max-w-3xl text-sm text-pretty text-muted">
            <span className="font-semibold text-ink">{t.detail.demoNote}:</span> {p.demoNote[lang]} {t.detail.concept}
          </p>
          <div className="mt-10 overflow-hidden rounded-2xl border border-line bg-surface-2 p-2 sm:p-4">
            <div className="overflow-hidden rounded-xl border border-line">
              <Shot slug={p.slug} shot={desktop[0]} lang={lang} priority />
            </div>
          </div>
        </div>

        <div className={`${container} grid gap-10 py-12 sm:py-16 lg:grid-cols-12`}>
          <aside className="lg:col-span-4 lg:order-2">
            <dl className="grid gap-6 rounded-2xl border border-line bg-surface p-6 lg:sticky lg:top-24">
              <div>
                <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{t.detail.type}</dt>
                <dd className="mt-1.5 font-medium">{p.kind[lang]}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{t.detail.role}</dt>
                <dd className="mt-1.5 text-sm">{t.hero.role}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{t.detail.stack}</dt>
                <dd className="mt-2">
                  <Chips items={p.stack} />
                </dd>
              </div>
              {p.tests && (
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{t.detail.tests}</dt>
                  <dd className="mt-1.5 font-medium">{p.tests}</dd>
                </div>
              )}
            </dl>
          </aside>

          <article className="min-w-0 lg:col-span-8">
            {sections.map((s) => (
              <section key={s.title} className="mb-10">
                <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">{s.title}</h2>
                <div className="prose-cs" dangerouslySetInnerHTML={{ __html: s.html }} />
              </section>
            ))}
          </article>
        </div>

        <section aria-labelledby="shots-title" className="border-y border-line bg-surface/60 py-12 sm:py-16">
          <div className={container}>
            <h2 id="shots-title" className="font-display text-2xl font-bold tracking-tight">
              {t.detail.screenshots}
            </h2>
            <ul className="mt-8 grid gap-6 md:grid-cols-2">
              {desktop.slice(1).map((s) => (
                <li key={s.file}>
                  <figure>
                    <div className="overflow-hidden rounded-xl border border-line">
                      <Shot slug={p.slug} shot={s} lang={lang} />
                    </div>
                    <figcaption className="mt-2 text-sm text-muted">{s.caption[lang]}</figcaption>
                  </figure>
                </li>
              ))}
            </ul>
            {phones.length > 0 && (
              <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {phones.map((s) => (
                  <li key={s.file}>
                    <figure>
                      <div className="overflow-hidden rounded-2xl border border-line">
                        <Shot slug={p.slug} shot={s} lang={lang} />
                      </div>
                      <figcaption className="mt-2 text-sm text-muted">{s.caption[lang]}</figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className={`${container} pt-12`}>
          <Link href={`/${lang}/projects/${next.slug}/`} className="group flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-6 hover:border-accent">
            <span>
              <span className="block text-sm text-muted">{t.detail.next}</span>
              <span className="mt-1 block font-display text-2xl font-extrabold tracking-tight group-hover:text-accent">{next.name}</span>
            </span>
            <Icon name="arrow" className="size-6 text-accent" />
          </Link>
        </div>

        <ContactSection lang={lang} />
      </main>
      <Footer lang={lang} />
    </div>
  );
}
