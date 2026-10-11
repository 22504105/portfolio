"use client";

import { useEffect } from "react";
import { getMessages } from "@/lib/i18n";

type ErrorProps = { error: Error & { digest?: string }; reset: () => void };

// What a workspace page shows when it fails. The failure itself is not shown:
// in production the server replaces its message anyway. The digest is a
// reference that can be matched to the server log.
export default function WorkspaceError({ error, reset }: ErrorProps) {
  const t = getMessages().failed;

  useEffect(() => {
    console.error("Page error", error.digest ?? "");
  }, [error]);

  return (
    <div role="alert" className="card max-w-2xl p-7 lg:p-9">
      <h1 className="type-page text-[1.5rem]">{t.title}</h1>
      <p className="text-ink-muted mt-2 max-w-prose">{t.body}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-input bg-brand hover:bg-brand-hover mt-6 inline-flex h-11 items-center px-5 font-medium text-white transition-colors"
      >
        {t.retry}
      </button>
      {error.digest && <p className="type-meta text-ink-muted mt-5 tabular-nums">Ref. {error.digest}</p>}
    </div>
  );
}
