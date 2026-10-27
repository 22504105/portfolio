import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactButtons, ContactSection, Chips, ExternalLink, Footer, Header, Icon, Shot, StatusBadge, buttonSecondary, container } from "@/components/ui";
import { contact, dict, isLang, localizeDemo } from "@/lib/i18n";
import { codeUrl, getProject, projects } from "@/lib/projects";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dict[lang];
  const other = lang === "en" ? "ru" : "en";

  return (
    <>
      <Header lang={lang} alternate={`/${other}/`} />
      <main id="main">
        <section className={`${container} pt-14 pb-16 sm:pt-24 sm:pb-24`}>
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">{t.hero.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">{t.hero.title}</h1>
          <p className="mt-6 max-w-3xl text-lg text-pretty sm:text-xl">{t.hero.lead}</p>
          <p className="mt-4 max-w-3xl text-pretty text-muted">{t.hero.role}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ContactButtons lang={lang} />
            <a href="#projects" className={buttonSecondary}>
              {t.hero.projects}
              <Icon name="arrow" />
            </a>
          </div>
          <ul className="mt-12 grid gap-3 text-sm sm:grid-cols-3">
            {t.hero.facts.map((f) => (
              <li key={f} className="rounded-2xl border border-line bg-surface px-4 py-3 font-medium">
                {f}
              </li>
            ))}
          </ul>
        </section>

        <section id="projects" aria-labelledby="projects-title" className="border-y border-line bg-surface/60 py-16 sm:py-24">
          <div className={container}>
            <h2 id="projects-title" className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t.projects.title}
            </h2>
            <p className="mt-3 max-w-3xl text-muted">{t.projects.lead}</p>
            <ol className="mt-10 grid gap-8 sm:gap-10">
              {projects.map((p, i) => {
                const desktop = p.shots.find((s) => s.kind === "desktop")!;
                const phone = p.shots.find((s) => s.kind === "phone");
                const detail = `/${lang}/projects/${p.slug}/`;
                return (
                  <li key={p.slug} className="grid overflow-hidden rounded-3xl border border-line bg-surface lg:grid-cols-12">
                    <Link href={detail} tabIndex={-1} aria-hidden className={`relative block bg-surface-2 p-4 sm:p-6 lg:col-span-7 ${i % 2 ? "lg:order-2" : ""}`}>
                      <div className="overflow-hidden rounded-xl border border-line shadow-sm">
                        <Shot slug={p.slug} shot={desktop} lang={lang} priority={i === 0} />
                      </div>
                      {phone && (
                        <div className="absolute right-3 bottom-3 w-[22%] max-w-36 overflow-hidden rounded-xl border-2 border-surface shadow-lg sm:right-5 sm:bottom-5">
                          <Shot slug={p.slug} shot={phone} lang={lang} />
                        </div>
                      )}
                    </Link>
                    <div className="flex flex-col gap-4 p-6 sm:p-8 lg:col-span-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-accent">{p.kind[lang]}</span>
                        <StatusBadge project={p} lang={lang} />
                      </div>
                      <h3 className="font-display text-2xl font-extrabold tracking-tight">
                        <Link href={detail} className="hover:text-accent">
                          {p.name}
                        </Link>
                      </h3>
                      <p className="text-pretty text-muted">{p.tagline[lang]}</p>
                      <Chips items={p.stack} />
                      {p.tests && (
                        <p className="text-sm text-muted">
                          <span className="font-semibold text-ink">{p.tests}</span> {t.projects.tests}
                        </p>
                      )}
                      <div className="mt-auto flex flex-wrap gap-2 pt-2">
                        <Link href={detail} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg hover:opacity-90">
                          {t.projects.caseStudy}
                          <Icon name="arrow" />
                        </Link>
                        <ExternalLink href={localizeDemo(p.demo, lang)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent">
                          {t.projects.demo}
                          <Icon name="external" />
                        </ExternalLink>
                        <ExternalLink href={codeUrl(p)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent">
                          <Icon name="github" />
                          {t.projects.code}
                        </ExternalLink>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section id="services" aria-labelledby="services-title" className={`${container} py-16 sm:py-24`}>
          <h2 id="services-title" className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t.services.title}
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.services.items.map((s) => {
              const example = getProject(s.example)!;
              return (
                <li key={s.name} className="flex flex-col rounded-2xl border border-line bg-surface p-6">
                  <h3 className="font-display text-lg font-bold">{s.name}</h3>
                  <p className="mt-2 flex-1 text-muted">{s.text}</p>
                  <Link href={`/${lang}/projects/${example.slug}/`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
                    {t.services.example}: {example.name}
                    <Icon name="arrow" />
                  </Link>
                </li>
              );
            })}
            <li className="flex flex-col justify-between rounded-2xl bg-accent p-6 text-on-accent">
              <p className="font-display text-lg font-bold">{t.cta.text}</p>
              <ExternalLink href={contact.telegram} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline">
                <Icon name="telegram" />
                {contact.telegramHandle}
              </ExternalLink>
            </li>
          </ul>
        </section>

        <section id="process" aria-labelledby="process-title" className="border-t border-line py-16 sm:py-24">
          <div className={container}>
            <h2 id="process-title" className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t.process.title}
            </h2>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {t.process.steps.map((s, i) => (
                <li key={s.name} className="rounded-2xl border border-line bg-surface p-6">
                  <span className="font-display text-sm font-extrabold text-accent">0{i + 1}</span>
                  <h3 className="mt-2 font-display text-lg font-bold">{s.name}</h3>
                  <p className="mt-2 text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <ContactSection lang={lang} />
      </main>
      <Footer lang={lang} />
    </>
  );
}
