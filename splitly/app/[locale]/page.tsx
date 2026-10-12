import { HandCoins, Languages, MonitorSmartphone, ScanLine, Send, Split, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { LocaleSwitch } from "@/components/shell/LocaleSwitch";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ILLUSTRATIONS } from "@/lib/illustrations";
import { pageLocale } from "@/lib/page";

// What each of the four promises looks like, and whether it is kept yet.
const FEATURES: readonly { icon: LucideIcon; built: boolean }[] = [
  { icon: ScanLine, built: true },
  { icon: Languages, built: true },
  { icon: Split, built: true },
  { icon: HandCoins, built: true },
];

// The front door, after the concept's cover: the mark, the promise, the
// friends with their bill, four things Splitly does, and two ways in.
export default async function OnboardingPage({ params }: PageProps<"/[locale]">) {
  const { locale, dictionary } = await pageLocale(params);
  const t = dictionary.onboarding;
  // The bot's public @name. With it the first button opens Telegram; without it, the page that explains how.
  const bot = /^[A-Za-z0-9_]{5,32}$/.test(process.env.TELEGRAM_BOT_USERNAME ?? "") ? process.env.TELEGRAM_BOT_USERNAME : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pt-[env(safe-area-inset-top)] sm:px-6">
      <a
        href="#main"
        className="rounded-control bg-primary text-on-primary fixed top-3 left-3 z-50 -translate-y-24 px-4 py-3 font-semibold transition-transform focus:translate-y-0"
      >
        {dictionary.nav.skip}
      </a>
      <header className="flex h-16 items-center justify-between gap-3 md:h-20">
        <Logo className="text-[1.5rem]" markClassName="size-10" />
        <div className="flex items-center gap-2">
          <LocaleSwitch locale={locale} labels={dictionary.language} />
          <ThemeToggle labels={dictionary.theme} />
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 pb-12 outline-none">
        <section className="grid items-center gap-x-12 gap-y-8 py-6 md:grid-cols-2 md:py-14">
          <div>
            <p className="text-ink-muted text-[1.0625rem]" lang="en">
              {dictionary.brand.tagline}
            </p>
            <h1 className="type-display mt-3 text-balance">{t.title}</h1>
            <p className="type-lead text-ink-muted mt-5 max-w-xl">{t.lead}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={bot ? `https://t.me/${bot}` : `/${locale}/app`}
                className="bg-hero text-on-hero shadow-raised inline-flex h-14 items-center justify-center gap-2.5 rounded-full px-7 text-[1.0625rem] font-semibold transition-opacity hover:opacity-92"
              >
                <Send aria-hidden="true" className="size-5" />
                {t.openTelegram}
              </a>
              <Link
                href={`/${locale}/demo`}
                className="border-field bg-surface text-ink hover:bg-surface-2 inline-flex h-14 items-center justify-center gap-2.5 rounded-full border px-7 text-[1.0625rem] font-semibold transition-colors"
              >
                <MonitorSmartphone aria-hidden="true" className="size-5" />
                {t.openDemo}
              </Link>
            </div>
            <p className="type-small text-ink-muted mt-3">{t.demoHint}</p>
          </div>

          <Image
            src={ILLUSTRATIONS.friends.src}
            alt={t.illustration}
            width={ILLUSTRATIONS.friends.width}
            height={ILLUSTRATIONS.friends.height}
            priority
            // A vector file is sharp at any size and is served as it is.
            unoptimized={ILLUSTRATIONS.friends.src.endsWith(".svg")}
            sizes="(min-width: 768px) 30rem, 100vw"
            className="h-auto w-full rounded-[24px]"
          />
        </section>

        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {FEATURES.map((feature, index) => (
            <li key={t.features[index]} className="card flex flex-col items-center gap-3 p-4 text-center">
              <span aria-hidden="true" className="bg-accent text-on-accent flex size-12 items-center justify-center rounded-full">
                <feature.icon className="size-6" />
              </span>
              <span className="font-semibold text-balance">{t.features[index]}</span>
              {!feature.built && <span className="type-small border-field text-ink-muted rounded-full border px-2 py-px">{t.soon}</span>}
            </li>
          ))}
        </ul>

        <p className="type-small text-ink-muted mt-8 max-w-2xl">{t.built}</p>
        <p className="type-small text-ink-muted mt-3 max-w-2xl">{t.limits}</p>
      </main>
    </div>
  );
}
