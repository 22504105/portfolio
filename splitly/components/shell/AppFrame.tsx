import { FlaskConical } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { Dictionary, Locale } from "@/lib/i18n";
import { BottomNav, SideNav } from "./AppNav";
import { LocaleSwitch } from "./LocaleSwitch";

type AppFrameProps = {
  locale: Locale;
  dictionary: Dictionary;
  /** Where the app lives, e.g. "/en/demo". */
  base: string;
  /** The browser demo says so on every screen. */
  demo?: boolean;
  children: ReactNode;
};

// The frame around every screen of the app, after the concept. On a phone: a
// slim top bar, the screen, and the bottom bar with the plus in the middle.
// From tablet width up: the concept's browser version, a deep green rail on
// the left and the content on warm paper beside it.
export function AppFrame({ locale, dictionary, base, demo = false, children }: AppFrameProps) {
  const { nav } = dictionary;

  return (
    <div className="flex min-h-dvh w-full">
      <a
        href="#main"
        className="rounded-control bg-primary text-on-primary fixed top-3 left-3 z-50 -translate-y-24 px-4 py-3 font-semibold transition-transform focus:translate-y-0"
      >
        {nav.skip}
      </a>

      <aside className="bg-hero w-rail sticky top-0 hidden h-dvh shrink-0 flex-col px-4 py-6 text-white md:flex print:hidden">
        <Link href={`/${locale}`} aria-label={nav.toHome} className="mb-8 inline-flex h-11 items-center self-start px-1.5">
          <Logo className="text-white" markClassName="ring-1 ring-white/25 rounded-[8px]" />
        </Link>
        <SideNav base={base} labels={nav} />
        <div className="mt-auto flex items-center gap-2">
          <LocaleSwitch locale={locale} labels={dictionary.language} />
          <ThemeToggle labels={dictionary.theme} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-canvas/95 sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:h-14 md:border-0 md:px-10 print:hidden">
          <Link href={`/${locale}`} aria-label={nav.toHome} className="inline-flex size-11 items-center justify-center md:hidden">
            <LogoMark />
          </Link>
          {demo && (
            <p
              title={dictionary.demo.note}
              className="type-small border-warning/40 bg-warning/10 text-warning inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 font-semibold whitespace-nowrap"
            >
              <FlaskConical aria-hidden="true" className="size-4" />
              {dictionary.demo.badge}
            </p>
          )}
          <div className="ml-auto flex items-center gap-2 md:hidden">
            <LocaleSwitch locale={locale} labels={dictionary.language} />
            <ThemeToggle labels={dictionary.theme} />
          </div>
        </header>

        {/* Room at the bottom for the bar and the phone's home indicator, so the last line is never underneath them. */}
        <main
          id="main"
          tabIndex={-1}
          className="flex-1 px-4 pt-5 pb-[calc(var(--spacing-nav)+env(safe-area-inset-bottom)+2rem)] outline-none md:px-10 md:pt-2 md:pb-12"
        >
          <div className="mx-auto w-full max-w-2xl md:mx-0 md:max-w-3xl">{children}</div>
        </main>
      </div>

      <BottomNav base={base} labels={nav} />
    </div>
  );
}
