import { Database } from "lucide-react";
import type { Metadata } from "next";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { demoOverview } from "@/lib/demo/view";
import { fill, getMessages } from "@/lib/i18n";
import { formatRange } from "@/lib/time";

export const metadata: Metadata = { title: "Overview" };

export default function DemoOverviewPage() {
  const messages = getMessages();
  const t = messages.overview;
  const { dataset, comparison } = demoOverview();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="type-page">{t.title}</h1>
          <p className="text-ink-muted mt-1.5 text-[0.9375rem]">
            {fill(t.subtitle, { workspace: dataset.workspace.name, range: formatRange(comparison.range) })}
          </p>
        </div>
        {/* Where the figures come from, next to the figures. */}
        <p className="type-meta border-line bg-surface text-ink-muted inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5">
          <Database aria-hidden="true" className="size-3.5" />
          {fill(t.provenanceDemo, { orders: new Intl.NumberFormat("en-US").format(dataset.orders.length) })}
        </p>
      </div>

      <div className="mt-7">
        <KpiCards comparison={comparison} currency={dataset.workspace.currency} messages={messages} />
      </div>

      <p className="rounded-card border-input text-ink-muted mt-7 border border-dashed px-5 py-4">{t.moreSoon}</p>
    </>
  );
}
