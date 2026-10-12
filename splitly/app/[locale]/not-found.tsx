import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { DEFAULT_LOCALE, getDictionary } from "@/lib/i18n";

// A "nothing here" page has no access to the address, so it speaks the default language and links home.
export default function NotFound() {
  const t = getDictionary(DEFAULT_LOCALE).notFound;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center px-6">
      <Logo />
      <h1 className="type-title mt-8">{t.title}</h1>
      <p className="text-ink-muted mt-2">{t.body}</p>
      <Link
        href={`/${DEFAULT_LOCALE}`}
        className="rounded-control bg-primary text-on-primary hover:bg-primary-hover mt-6 inline-flex h-12 items-center px-5 font-semibold transition-colors"
      >
        {t.home}
      </Link>
    </main>
  );
}
