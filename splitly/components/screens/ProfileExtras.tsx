"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useApp } from "@/components/app/AppProvider";
import { Confirm, inputClass, Problem } from "@/components/ui/controls";
import { fill } from "@/lib/i18n";
import { CURRENCIES } from "@/lib/money/currency";
import { preferredCurrency, rememberCurrency } from "@/lib/preferences";

/** The currency offered first for a new group, and the way to what Splitly keeps. For everyone, on this device. */
function Preferences() {
  const { t, locale } = useApp();
  // The stored choice is on the device: it can be read only once the page is alive in the browser, not while it is prepared.
  const inBrowser = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <section aria-labelledby="profile-currency" className="card mt-4 p-5 sm:p-6">
      <h2 id="profile-currency" className="type-heading">
        {t.profile.currency}
      </h2>
      <p className="type-small text-ink-muted mt-1 mb-4">{t.profile.currencyHint}</p>
      <select
        aria-labelledby="profile-currency"
        className={`${inputClass} max-w-40`}
        value={chosen ?? (inBrowser ? preferredCurrency() : "TRY")}
        onChange={(event) => {
          setChosen(event.target.value);
          rememberCurrency(event.target.value);
        }}
      >
        {CURRENCIES.map((code) => (
          <option key={code}>{code}</option>
        ))}
      </select>
      <p className="mt-4">
        <Link
          href={`/${locale}/privacy`}
          className="type-small text-ink inline-flex h-11 items-center font-semibold underline underline-offset-4"
        >
          {t.privacy.link}
        </Link>
      </p>
    </section>
  );
}

/** The part of the profile that depends on where the data lives: the demo can be started over, an account can be deleted. */
export function ProfileExtras() {
  const { t, account, resetDemo, changed, notify } = useApp();
  const [failure, setFailure] = useState<string | null>(null);

  if (account) {
    return (
      <>
        <Preferences />
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
      </>
    );
  }

  if (!resetDemo) return <Preferences />;
  return (
    <>
      <Preferences />
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
    </>
  );
}
