import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LinkButton } from "@/components/ui/link-button";
import { getMessages } from "@/lib/i18n";
import { accountsEnabled } from "@/lib/supabase/env";

/** The frame of the account pages: logo, a title, and the form or a note that accounts are off. */
export function AuthPage({ title, children }: { title: string; children: ReactNode }) {
  const messages = getMessages();
  const enabled = accountsEnabled();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-line border-b">
        <div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center justify-between px-5 md:px-8">
          <Link href="/" aria-label={messages.nav.home} className="text-ink inline-flex h-11 items-center">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle labels={messages.theme} />
            <LinkButton href="/demo" variant="ghost">
              {messages.auth.toDemo}
            </LinkButton>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[27rem] flex-1 px-5 py-12 md:py-20">
        <h1 className="type-page">{enabled ? title : messages.auth.notConfiguredTitle}</h1>
        <div className="mt-6">
          {enabled ? (
            children
          ) : (
            <>
              <p className="text-ink-muted text-[0.9375rem] leading-relaxed">{messages.auth.notConfigured}</p>
              <LinkButton href="/demo" className="mt-7">
                {messages.auth.toDemo}
              </LinkButton>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
