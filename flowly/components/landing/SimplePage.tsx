import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { getMessages } from "@/lib/i18n";

/** A page with the logo, a title and a little text: sign-in, privacy, not found. */
export function SimplePage({ title, children }: { title: string; children: ReactNode }) {
  const messages = getMessages();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-line border-b">
        <div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center px-5 md:px-8">
          <Link href="/" aria-label={messages.nav.home} className="text-ink inline-flex h-11 items-center">
            <Logo />
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[1240px] flex-1 px-5 py-14 md:px-8 md:py-20">
        <h1 className="type-page">{title}</h1>
        <div className="text-ink-muted mt-5 max-w-[38rem] text-[0.9375rem] leading-relaxed">{children}</div>
      </main>
    </div>
  );
}
