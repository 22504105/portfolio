import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { LinkButton } from "@/components/ui/link-button";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: "Privacy and data handling" };

export default function PrivacyPage() {
  const messages = getMessages();
  const t = messages.privacy;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-line border-b">
        <div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center justify-between px-5 md:px-8">
          <Link href="/" aria-label={messages.nav.home} className="text-ink inline-flex h-11 items-center">
            <Logo />
          </Link>
          <LinkButton href="/demo" variant="ghost">
            {messages.auth.toDemo}
          </LinkButton>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[44rem] flex-1 px-5 py-14 md:px-8 md:py-20">
        <p className="type-meta text-ink-muted">{t.updated}</p>
        <h1 className="type-page mt-2">{t.title}</h1>
        <p className="type-lead text-ink-muted mt-5">{t.lead}</p>
        {t.sections.map((section) => (
          <section key={section.title} className="mt-10">
            <h2 className="text-[1.25rem] font-semibold tracking-[-0.02em]">{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-[0.9375rem] leading-relaxed">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}
