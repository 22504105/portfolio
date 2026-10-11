import { Download } from "lucide-react";
import { PageHeader } from "@/components/dashboard/parts";
import { BatchList } from "@/components/imports/BatchList";
import { ImportWizard } from "@/components/imports/ImportWizard";
import type { ImportBatch } from "@/lib/data/workspace";
import type { Messages } from "@/lib/i18n";
import { FIELDS } from "@/lib/import/types";
import { sectionHref } from "@/lib/routes";
import type { WorkspaceContext } from "@/lib/workspace";

type ImportsPageProps = {
  context: WorkspaceContext;
  messages: Messages;
  /** Earlier imports of a signed-in workspace. The demo has none: it stores nothing. */
  batches?: ImportBatch[];
};

export function ImportsPage({ context, messages, batches }: ImportsPageProps) {
  const { dataset, root } = context;
  const demo = root === "/demo";
  const t = messages.imports;
  const download =
    "inline-flex h-10 items-center gap-2 rounded-input border border-input bg-surface px-3.5 font-medium transition-colors hover:bg-surface-2";

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />

      {demo && <p className="rounded-input border-brand/25 bg-brand-tint text-brand-hover mt-5 max-w-3xl border px-4 py-3">{t.demoNote}</p>}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <ImportWizard
          messages={messages}
          workspace={{ id: dataset.workspace.id, currency: dataset.workspace.currency, timezone: dataset.workspace.timezone }}
          // The demo imports nothing, so nothing in a file can already be there.
          existingIds={demo ? [] : dataset.orders.map((order) => order.externalId)}
          demo={demo}
          overviewHref={sectionHref(root, "overview")}
        />

        <aside className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="samples-title" className="card p-5">
            <h2 id="samples-title" className="type-card">
              {t.samples}
            </h2>
            <p className="text-ink-muted mt-1.5">{t.samplesBody}</p>
            <div className="mt-4 flex flex-col items-start gap-2">
              <a href="/samples/flowly-sample.csv" download className={download}>
                <Download aria-hidden="true" className="size-4" />
                {t.sampleCsv}
              </a>
              <a href="/samples/flowly-template.xlsx" download className={download}>
                <Download aria-hidden="true" className="size-4" />
                {t.sampleXlsx}
              </a>
            </div>
          </section>

          <section aria-labelledby="fields-title" className="card p-5">
            <h2 id="fields-title" className="type-card">
              {t.fieldsTitle}
            </h2>
            <dl className="mt-3 flex flex-col gap-3">
              {FIELDS.map((field) => (
                <div key={field}>
                  <dt className="font-medium">{messages.importer.fields[field]}</dt>
                  <dd className="type-meta text-ink-muted">{messages.importer.fieldHelp[field]}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>

      {batches && (
        <section aria-labelledby="previous-title" className="mt-8">
          <h2 id="previous-title" className="type-card mb-3 text-[1.0625rem]">
            {t.previous}
          </h2>
          <BatchList batches={batches} timezone={dataset.workspace.timezone} labels={t} />
        </section>
      )}
    </>
  );
}
