import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import { PageHeader } from "@/components/dashboard/parts";
import { DangerForm, WorkspaceForm } from "@/components/settings/SettingsForms";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { fill, type Messages } from "@/lib/i18n";
import { CURRENCIES, timezones } from "@/lib/settings/options";
import type { WorkspaceContext } from "@/lib/workspace";

const whole = new Intl.NumberFormat("en-US");

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="card p-5 lg:p-7">
      <h2 id={id} className="type-card mb-4 text-[1.0625rem]">
        {title}
      </h2>
      {children}
    </section>
  );
}

type SettingsPageProps = {
  context: WorkspaceContext;
  messages: Messages;
  /** The signed-in account. Absent in the demo, where nothing can be changed. */
  account?: { email: string };
  /** How many imports the workspace holds. */
  batches?: number;
};

export function SettingsPage({ context, messages, account, batches = 0 }: SettingsPageProps) {
  const { dataset } = context;
  const { workspace } = dataset;
  const t = messages.settings;
  const link = "font-medium text-brand-hover underline-offset-4 hover:underline";
  const facts: [string, string][] = [
    [t.name, workspace.name],
    [t.currency, workspace.currency],
    [t.timezone, workspace.timezone.replace(/_/g, " ")],
  ];

  return (
    <>
      <PageHeader title={t.title} />

      <div className="mt-7 flex max-w-3xl flex-col gap-6">
        {!account && <p className="rounded-input border-brand/25 bg-brand-tint text-brand-hover border px-4 py-3">{t.demoNote}</p>}

        <Section id="settings-workspace" title={t.workspace}>
          {account ? (
            <WorkspaceForm
              labels={t}
              workspace={{ name: workspace.name, currency: workspace.currency, timezone: workspace.timezone }}
              hasOrders={dataset.orders.length > 0}
              currencies={CURRENCIES}
              timezones={timezones()}
            />
          ) : (
            <dl className="divide-line divide-y">
              {facts.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Section>

        {account && (
          <>
            <Section id="settings-profile" title={t.profile}>
              <dl>
                <dt className="text-ink-muted">{t.email}</dt>
                <dd className="mt-1 text-[0.9375rem] font-medium break-all">{account.email}</dd>
              </dl>
              <p className="type-meta text-ink-muted mt-2">{t.emailHint}</p>
            </Section>

            <Section id="settings-security" title={t.security}>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/update-password"
                  className="rounded-input border-input bg-surface hover:bg-surface-2 inline-flex h-11 items-center border px-5 font-medium transition-colors"
                >
                  {t.changePassword}
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="rounded-input border-input bg-surface hover:bg-surface-2 inline-flex h-11 items-center border px-5 font-medium transition-colors"
                  >
                    {t.signOut}
                  </button>
                </form>
              </div>
            </Section>

            <Section id="settings-data" title={t.data}>
              <p className="text-ink-muted mb-4 max-w-prose">
                {fill(t.dataBody, { orders: whole.format(dataset.orders.length), batches: whole.format(batches) })}
              </p>
              <DangerForm labels={t} kind="data" expected={workspace.name} nothingToDelete={dataset.orders.length === 0 && batches === 0} />
            </Section>

            <Section id="settings-account" title={t.account}>
              <p className="text-ink-muted mb-4 max-w-prose">{t.accountBody}</p>
              <DangerForm labels={t} kind="account" expected={account.email} />
            </Section>
          </>
        )}

        <Section id="settings-appearance" title={messages.theme.appearance}>
          <ThemeToggle labels={messages.theme} expanded />
          <p className="type-meta text-ink-muted mt-3">{messages.theme.appearanceBody}</p>
        </Section>

        <Section id="settings-limits" title={t.limits}>
          <p className="text-ink-muted max-w-prose">{t.limitsBody}</p>
          <Link href="/privacy" className={`${link} mt-3 inline-flex min-h-11 items-center`}>
            {t.privacy}
          </Link>
        </Section>
      </div>
    </>
  );
}
