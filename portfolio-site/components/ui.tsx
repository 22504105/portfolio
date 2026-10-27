import Link from "next/link";
import shotSizes from "@/content/shots.json";
import { contact, dict, type Lang } from "@/lib/i18n";
import type { Shot as ShotData } from "@/lib/projects";

const sizes: Record<string, number[]> = shotSizes;

export const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";

type IconName = "telegram" | "mail" | "github" | "arrow" | "external";

export function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  const common = { className, "aria-hidden": true, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" } as const;
  switch (name) {
    case "telegram":
      return (
        <svg {...common}>
          <path d="M21.5 4.5 2.8 11.6c-.9.3-.9 1.1 0 1.4l4.7 1.5 1.8 5.6c.2.6.9.8 1.4.4l2.6-2.2 4.9 3.6c.6.4 1.4.1 1.6-.6L22.9 5.9c.2-1-.5-1.7-1.4-1.4Z" />
          <path d="m7.5 14.5 10-7-7.5 8.2" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
        </svg>
      );
    case "github":
      return (
        <svg {...common}>
          <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      );
    case "external":
      return (
        <svg {...common}>
          <path d="M14 4h6v6m0-6L10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </svg>
      );
  }
}

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors";
export const buttonPrimary = `${buttonBase} bg-accent text-on-accent hover:bg-accent-hover`;
export const buttonSecondary = `${buttonBase} border border-line bg-surface text-ink hover:border-accent hover:text-accent`;

export function ExternalLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export function ContactButtons({ lang }: { lang: Lang }) {
  const t = dict[lang].hero;
  return (
    <div className="flex flex-wrap gap-3">
      <ExternalLink href={contact.telegram} className={buttonPrimary}>
        <Icon name="telegram" />
        {t.telegram}
      </ExternalLink>
      <a href={`mailto:${contact.email}`} className={buttonSecondary}>
        <Icon name="mail" />
        {t.email}
      </a>
    </div>
  );
}

export function Header({ lang, alternate }: { lang: Lang; alternate: string }) {
  const t = dict[lang].nav;
  const home = `/${lang}/`;
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/85 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        {dict[lang].skip}
      </a>
      <div className={`${container} flex h-16 items-center justify-between gap-4`}>
        <Link href={home} className="font-display text-lg font-extrabold tracking-tight">
          {lang === "ru" ? "Евгений" : "Evgeniy"}
          <span className="text-accent">.</span>
        </Link>
        <nav aria-label={lang === "ru" ? "Основное меню" : "Main"} className="flex items-center gap-1 text-sm sm:gap-2">
          <Link href={`${home}#projects`} className="hidden rounded-full px-3 py-2 text-muted hover:text-ink md:inline-block">
            {t.projects}
          </Link>
          <Link href={`${home}#services`} className="hidden rounded-full px-3 py-2 text-muted hover:text-ink md:inline-block">
            {t.services}
          </Link>
          <Link href={`${home}#process`} className="hidden rounded-full px-3 py-2 text-muted hover:text-ink md:inline-block">
            {t.process}
          </Link>
          <Link href={alternate} hrefLang={lang === "ru" ? "en" : "ru"} aria-label={t.otherLabel} className="rounded-full px-3 py-2 font-semibold text-muted hover:text-ink">
            {t.other}
          </Link>
          <Link href={`${home}#contact`} className="rounded-full bg-ink px-4 py-2 font-semibold text-bg hover:opacity-90">
            {t.contact}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function ContactSection({ lang }: { lang: Lang }) {
  const t = dict[lang].cta;
  return (
    <section id="contact" aria-labelledby="contact-title" className={`${container} py-16 sm:py-24`}>
      <div className="rounded-3xl border border-line bg-surface p-6 sm:p-12">
        <h2 id="contact-title" className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t.title}
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-muted">{t.text}</p>
        <p className="mt-2 max-w-2xl text-muted">{t.pricing}</p>
        <div className="mt-8">
          <ContactButtons lang={lang} />
        </div>
        <dl className="mt-8 grid gap-4 border-t border-line pt-6 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Telegram</dt>
            <dd className="mt-1 font-medium">
              <ExternalLink href={contact.telegram} className="hover:text-accent">
                {contact.telegramHandle}
              </ExternalLink>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Email</dt>
            <dd className="mt-1 font-medium break-all">
              <a href={`mailto:${contact.email}`} className="hover:text-accent">
                {contact.email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-muted">GitHub</dt>
            <dd className="mt-1 font-medium">
              <ExternalLink href={contact.github} className="hover:text-accent">
                github.com/22504105
              </ExternalLink>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export function Footer({ lang }: { lang: Lang }) {
  const t = dict[lang].footer;
  return (
    <footer className="border-t border-line">
      <div className={`${container} flex flex-col gap-3 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between`}>
        <p>
          {lang === "ru" ? "Евгений" : "Evgeniy"} · {t.role}
        </p>
        <ExternalLink href={contact.repo} className="inline-flex items-center gap-2 hover:text-ink">
          <Icon name="github" />
          {t.code}
        </ExternalLink>
      </div>
    </footer>
  );
}

export function Chips({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <li key={s} className="rounded-md bg-surface-2 px-2 py-1 text-xs font-medium text-muted">
          {s}
        </li>
      ))}
    </ul>
  );
}

export function Shot({ slug, shot, lang, priority = false, className = "" }: { slug: string; shot: ShotData; lang: Lang; priority?: boolean; className?: string }) {
  const [width, height] = sizes[`${slug}/${shot.file}`] ?? [1440, 900];
  return (
    // Static export: images are pre-sized by `npm run sync`, so a plain <img> is enough.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/shots/${slug}/${shot.file}`}
      alt={shot.caption[lang]}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={`h-auto w-full ${className}`}
    />
  );
}
