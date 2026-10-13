"use client";

import { BadgeCheck, ChevronRight, Coins, FlaskConical, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useApp, useLoad } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Confirm, inputClass, Problem } from "@/components/ui/controls";
import { fill } from "@/lib/i18n";
import { CURRENCIES } from "@/lib/money/currency";
import { preferredCurrency, rememberCurrency } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { SectionTitle, SettingRow } from "./settings-parts";

/** Who this is: the face and name the groups know them by, and how much there is. Counted from the groups, never made up. */
export function ProfileCard() {
  const { t, account } = useApp();
  const { data: groups } = useLoad((store) => store.listGroups(), "groups");
  const open = groups?.filter((group) => !group.archivedAt);
  const self = groups?.flatMap((group) => group.members).find((member) => member.self);
  const name = account?.displayName ?? self?.name ?? t.profile.demoName;
  const Chip = account ? BadgeCheck : FlaskConical;
  const stats = [
    [t.profile.statGroups, open?.length],
    [t.profile.statExpenses, open?.reduce((sum, group) => sum + group.expenseCount, 0)],
  ] as const;

  return (
    <section aria-label={name} className="card mt-5 p-4">
      <div className="flex items-center gap-4">
        <Avatar name={name} seed={self?.id} photo={self?.photoUrl} className="size-16 shrink-0" />
        <div className="min-w-0">
          <p className="type-heading break-words">{name}</p>
          <p
            className={cn(
              "mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] leading-4 font-semibold",
              account ? "bg-accent-soft text-on-accent" : "bg-warning/10 text-warning",
            )}
          >
            <Chip aria-hidden="true" className="size-3.5" />
            {account ? t.profile.telegram : t.demo.badge}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-surface-2 rounded-control flex flex-col-reverse p-3 text-center">
            <dt className="text-ink-muted text-[0.75rem] leading-4">{label}</dt>
            <dd className="text-[1.25rem] leading-7 font-bold tabular-nums">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** The currency offered first for a new group. For everyone, on this device. */
export function CurrencyRow() {
  const { t } = useApp();
  // The stored choice is on the device: it can be read only once the page is alive in the browser, not while it is prepared.
  const inBrowser = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <SettingRow icon={Coins} title={t.profile.currency} titleId="profile-currency" hint={t.profile.currencyHint}>
      <select
        aria-labelledby="profile-currency"
        className={cn(inputClass, "w-28 shrink-0 font-semibold")}
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
    </SettingRow>
  );
}

/** The way to what Splitly keeps, and the part that depends on where the data lives. */
export function ProfileExtras() {
  const { t, locale, account, resetDemo, changed, notify } = useApp();
  const [failure, setFailure] = useState<string | null>(null);

  return (
    <>
      <SectionTitle icon={ShieldCheck}>{t.profile.data}</SectionTitle>
      <div className="card mt-2.5">
        <Link
          href={`/${locale}/privacy`}
          className="hover:bg-surface-2/60 rounded-card flex min-h-16 items-center gap-3 p-4 transition-colors"
        >
          <span aria-hidden="true" className="bg-surface-2 text-ink flex size-11 shrink-0 items-center justify-center rounded-[12px]">
            <ShieldCheck className="size-5" />
          </span>
          <span className="min-w-0 flex-1 font-semibold">{t.privacy.link}</span>
          <ChevronRight aria-hidden="true" className="text-ink-muted size-5 shrink-0" />
        </Link>
      </div>

      {account && (
        <>
          <SectionTitle icon={UserRound} id="profile-account">
            {t.account.title}
          </SectionTitle>
          <section aria-labelledby="profile-account" className="card mt-2.5 p-4">
            <p className="type-small text-ink-muted break-words">{fill(t.account.signedIn, { name: account.displayName })}</p>
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
      )}

      {!account && resetDemo && (
        <>
          <SectionTitle icon={FlaskConical} id="profile-demo">
            {t.account.demoTitle}
          </SectionTitle>
          <section aria-labelledby="profile-demo" className="card mt-2.5 p-4">
            <p className="type-small text-ink-muted mb-4">{t.account.demoHint}</p>
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
      )}
    </>
  );
}
