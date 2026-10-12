"use client";

import { useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { Confirm, Problem } from "@/components/ui/controls";
import { fill } from "@/lib/i18n";

/** The part of the profile that depends on where the data lives: the demo can be started over, an account can be deleted. */
export function ProfileExtras() {
  const { t, account, resetDemo, changed, notify } = useApp();
  const [failure, setFailure] = useState<string | null>(null);

  if (account) {
    return (
      <section aria-labelledby="profile-account" className="card mt-4 p-5 sm:p-6">
        <h2 id="profile-account" className="type-heading">
          {t.account.title}
        </h2>
        <p className="type-small text-ink-muted mt-1 break-words">{fill(t.account.signedIn, { name: account.displayName })}</p>
        <p className="type-small text-ink-muted mt-4 mb-3">{t.account.deleteHint}</p>
        {failure && <Problem className="mb-3">{failure}</Problem>}
        <Confirm
          label={t.account.delete}
          question={t.account.deleteConfirm}
          yes={t.common.yes}
          no={t.common.no}
          onConfirm={async () => {
            setFailure(null);
            try {
              await account.remove();
            } catch {
              setFailure(t.errors.server_error);
            }
          }}
        />
      </section>
    );
  }

  if (!resetDemo) return null;
  return (
    <section aria-labelledby="profile-demo" className="card mt-4 p-5 sm:p-6">
      <h2 id="profile-demo" className="type-heading">
        {t.account.demoTitle}
      </h2>
      <p className="type-small text-ink-muted mt-1 mb-4">{t.account.demoHint}</p>
      <Confirm
        label={t.account.reset}
        question={t.account.resetConfirm}
        yes={t.common.yes}
        no={t.common.no}
        variant="secondary"
        onConfirm={() => {
          resetDemo();
          changed();
          notify(t.account.resetDone);
        }}
      />
    </section>
  );
}
