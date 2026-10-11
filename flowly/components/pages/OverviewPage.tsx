import { Database } from "lucide-react";
import Link from "next/link";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { BarList, Card, EmptyState, formatShare, PageHeader, Stat, StatusChip, textLink } from "@/components/dashboard/parts";
import { TrendSection } from "@/components/dashboard/TrendSection";
import { fill, type Messages } from "@/lib/i18n";
import { breakdown } from "@/lib/metrics/breakdown";
import { customerLabel } from "@/lib/metrics/customers";
import { formatMoney } from "@/lib/money";
import { sectionHref } from "@/lib/routes";
import { formatInstant, formatRange } from "@/lib/time";
import { hrefWith, sharedQuery } from "@/lib/view/state";
import type { PageData } from "@/lib/workspace";

const whole = new Intl.NumberFormat("en-US");

export function OverviewPage({ page, messages }: { page: PageData; messages: Messages }) {
  const { context, view, inPeriod, comparison, params } = page;
  const { dataset, root } = context;
  const { currency, timezone, name } = dataset.workspace;
  const t = messages.overview;
  const query = sharedQuery(params);
  const analytics = sectionHref(root, "analytics");
  const transactions = sectionHref(root, "transactions");

  const channels = breakdown(inPeriod, "channel");
  const products = breakdown(inPeriod, "product").slice(0, 6);
  const recent = [...inPeriod].sort((a, b) => b.placedAt - a.placedAt).slice(0, 6);
  const customers = new Map(dataset.customers.map((customer) => [customer.id, customer]));
  const { current } = comparison;

  return (
    <>
      <PageHeader title={t.title} subtitle={fill(t.subtitle, { workspace: name, range: formatRange(view.range) })}>
        {/* Where the figures come from, next to the figures. */}
        {dataset.provenance.kind === "demo" && (
          <p className="type-meta border-line bg-surface text-ink-muted inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5">
            <Database aria-hidden="true" className="size-3.5" />
            {fill(t.provenanceDemo, { orders: whole.format(dataset.orders.length) })}
          </p>
        )}
      </PageHeader>

      <div className="mt-7">
        <KpiCards comparison={comparison} currency={currency} messages={messages} />
      </div>

      <dl className="mt-5 grid gap-5 sm:grid-cols-3 lg:mt-6 lg:gap-6">
        <Stat label={t.repeatRate} value={formatShare(current.repeatRate)} note={t.repeatNote} />
        <Stat label={t.refunded} value={formatMoney(current.refundedMinor, currency)} note={t.refundedNote} />
        {/* There is no traffic data, so there is no conversion rate, and the page says so. */}
        <Stat label={t.conversion} value={t.conversionUnavailable} note={t.conversionNote} muted />
      </dl>

      <div className="mt-5 grid gap-5 lg:mt-6 lg:grid-cols-12 lg:gap-6">
        <Card
          title={t.revenueTrend}
          titleId="trend-title"
          className="lg:col-span-8"
          action={
            <Link href={analytics + query} className={textLink}>
              {t.seeAnalytics}
            </Link>
          }
        >
          <TrendSection page={page} messages={messages} />
        </Card>

        <Card title={t.channels} titleId="channels-title" className="lg:col-span-4">
          {channels.length === 0 ? (
            <EmptyState title={messages.chart.empty} hint={messages.chart.emptyHint} />
          ) : (
            <BarList
              rows={channels}
              currency={currency}
              series={2}
              hrefFor={(key) => hrefWith(analytics, params, { channel: key })}
              linkLabel={(key) => fill(messages.analytics.filterBy, { value: key })}
            />
          )}
        </Card>

        <Card title={t.topProducts} titleId="products-title" className="lg:col-span-5">
          {products.length === 0 ? (
            <EmptyState title={messages.chart.empty} hint={messages.chart.emptyHint} />
          ) : (
            <BarList
              rows={products}
              currency={currency}
              series={3}
              hrefFor={(key) => hrefWith(analytics, params, { product: key, by: "product" })}
              linkLabel={(key) => fill(messages.analytics.filterBy, { value: key })}
            />
          )}
        </Card>

        <Card
          title={t.recent}
          titleId="recent-title"
          className="lg:col-span-7"
          action={
            <Link href={transactions + query} className={textLink}>
              {t.seeAll}
            </Link>
          }
        >
          {recent.length === 0 ? (
            <EmptyState title={messages.transactions.empty} hint={messages.transactions.emptyHint} />
          ) : (
            <ul className="divide-line -my-1 divide-y">
              {recent.map((order) => {
                const customer = order.customerId ? customers.get(order.customerId) : undefined;
                return (
                  <li key={order.id} className="flex items-center gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={hrefWith(transactions, params, { order: order.externalId })}
                        aria-label={fill(messages.transactions.open, { id: order.externalId })}
                        className="font-medium tabular-nums underline-offset-4 hover:underline"
                      >
                        {order.externalId}
                      </Link>
                      <p className="type-meta text-ink-muted truncate">
                        {customer ? customerLabel(customer) : messages.transactions.guest} · {formatInstant(order.placedAt, timezone, true)}
                      </p>
                    </div>
                    <StatusChip status={order.status} labels={messages.status} />
                    <p className="w-20 shrink-0 text-right font-medium tabular-nums">{formatMoney(order.netMinor, currency)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
