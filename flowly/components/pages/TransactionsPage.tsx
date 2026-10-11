import { Download } from "lucide-react";
import Link from "next/link";
import { FilterBar } from "@/components/controls/FilterBar";
import {
  EmptyState,
  PageHeader,
  Pagination,
  SearchForm,
  SortChips,
  SortHeader,
  StatusChip,
  TableFrame,
  td,
  th,
} from "@/components/dashboard/parts";
import { DetailSheet } from "@/components/detail/DetailSheet";
import type { Order } from "@/lib/domain/types";
import { fill, type Messages } from "@/lib/i18n";
import { customerLabel } from "@/lib/metrics/customers";
import { formatMoney } from "@/lib/money";
import { sectionHref } from "@/lib/routes";
import { formatInstant, formatRange } from "@/lib/time";
import { cn } from "@/lib/utils";
import { customerIndex, paginate, transactionRows, TRANSACTIONS_PER_PAGE } from "@/lib/view/lists";
import { hrefWith } from "@/lib/view/state";
import type { PageData } from "@/lib/workspace";

const whole = new Intl.NumberFormat("en-US");

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-2", strong && "font-semibold")}>
      <dt className={cn(!strong && "text-ink-muted")}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function OrderDetails({ order, page, messages }: { order: Order; page: PageData; messages: Messages }) {
  const { context, params } = page;
  const { currency, timezone } = context.dataset.workspace;
  const t = messages.transactions;
  const customer = order.customerId ? customerIndex(context.dataset.customers).get(order.customerId) : undefined;
  const money = (minor: number) => formatMoney(minor, currency);
  const counted = order.status === "completed";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <StatusChip status={order.status} labels={messages.status} />
        <p className="text-ink-muted">{counted ? `${t.counted}: ${money(order.netMinor - order.refundMinor)}` : t.notCounted}</p>
      </div>

      <dl className="card divide-line divide-y px-5 py-2">
        <Row label={t.placed} value={formatInstant(order.placedAt, timezone, true)} />
        <div className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-ink-muted">{t.customer}</dt>
          <dd className="min-w-0 truncate text-right">
            {customer ? (
              <Link
                href={hrefWith(sectionHref(context.root, "customers"), params, { customer: customer.id, q: null, sort: null, dir: null })}
                className="text-brand-hover font-medium underline-offset-4 hover:underline"
              >
                {customerLabel(customer)}
              </Link>
            ) : (
              t.guest
            )}
          </dd>
        </div>
        <Row label={t.channel} value={order.channel ?? messages.table.notProvided} />
      </dl>

      <section aria-labelledby="lines-title">
        <h3 id="lines-title" className="type-card mb-3">
          {t.lines}
        </h3>
        <div role="region" aria-labelledby="lines-title" tabIndex={0} className="card overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="border-line bg-surface-2 border-b">
              <tr>
                <th scope="col" className={th}>
                  {t.product}
                </th>
                <th scope="col" className={cn(th, "text-right")}>
                  {t.quantity}
                </th>
                <th scope="col" className={cn(th, "text-right")}>
                  {t.unitPrice}
                </th>
                <th scope="col" className={cn(th, "text-right")}>
                  {t.net}
                </th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y tabular-nums">
              {order.lines.map((line, index) => (
                <tr key={index}>
                  <th scope="row" className={cn(td, "font-normal")}>
                    <span className="font-medium">{line.productName ?? messages.table.notProvided}</span>
                    <span className="type-meta text-ink-muted block">{line.category ?? messages.table.notProvided}</span>
                  </th>
                  <td className={cn(td, "text-right")}>{line.quantity}</td>
                  <td className={cn(td, "text-right")}>{money(line.unitPriceMinor)}</td>
                  <td className={cn(td, "text-right")}>{money(line.netMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <dl className="card divide-line divide-y px-5 py-2">
        <Row label={t.gross} value={money(order.grossMinor)} />
        <Row label={t.discount} value={order.discountMinor === 0 ? money(0) : `−${money(order.discountMinor)}`} />
        <Row label={t.net} value={money(order.netMinor)} strong />
        {order.refundMinor > 0 && <Row label={t.refund} value={`−${money(order.refundMinor)}`} />}
      </dl>

      <p className="type-meta text-ink-muted">{fill(t.timezoneNote, { timezone })}</p>
    </>
  );
}

export function TransactionsPage({ page, messages }: { page: PageData; messages: Messages }) {
  const { context, pathname, params, view } = page;
  const { dataset } = context;
  const { currency, timezone } = dataset.workspace;
  const t = messages.transactions;
  const customers = customerIndex(dataset.customers);

  const all = transactionRows(page);
  const { rows, page: current } = paginate(all, view.page, TRANSACTIONS_PER_PAGE);
  const sort = { pathname, params, view, labels: messages.table };
  // The drawer shows the whole order as it is, not narrowed by any filter.
  const open = view.order ? dataset.orders.find((order) => order.externalId === view.order) : undefined;
  const narrowed = view.filters.category !== null || view.filters.product !== null;

  return (
    <>
      <PageHeader title={t.title} subtitle={fill(t.subtitle, { count: whole.format(all.length), range: formatRange(view.range) })}>
        <a
          href={hrefWith(`${context.root}/export/transactions`, params, {})}
          title={fill(t.downloadNote, { count: whole.format(all.length) })}
          className="rounded-input border-input bg-surface hover:bg-surface-2 inline-flex h-10 items-center gap-2 border px-3.5 font-medium transition-colors"
        >
          <Download aria-hidden="true" className="size-4" />
          {t.download}
        </a>
      </PageHeader>

      <div className="mt-6 flex flex-col gap-4">
        <FilterBar page={page} messages={messages} />
        <SearchForm
          pathname={pathname}
          params={params}
          query={view.query}
          label={t.search}
          placeholder={t.searchPlaceholder}
          labels={messages.table}
        />
        {narrowed && <p className="type-meta text-ink-muted">{t.narrowed}</p>}
      </div>

      <div className="mt-5">
        {all.length === 0 ? (
          <div className="card">
            <EmptyState title={t.empty} hint={t.emptyHint} />
          </div>
        ) : (
          <>
            <SortChips
              columns={[
                ["date", t.date],
                ["amount", t.amount],
                ["status", t.status],
                ["order", t.order],
              ]}
              {...sort}
              until="lg"
            />
            {/* On a phone a seven-column table is a strip to drag about; each order is a card instead. */}
            <ul className="card divide-line mt-2 divide-y lg:hidden">
              {rows.map((order) => {
                const customer = order.customerId ? customers.get(order.customerId) : undefined;
                return (
                  <li key={order.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={hrefWith(pathname, params, { order: order.externalId })}
                        scroll={false}
                        aria-label={fill(t.open, { id: order.externalId })}
                        className="text-brand-hover inline-flex min-h-8 items-center font-medium tabular-nums underline-offset-4 hover:underline"
                      >
                        {order.externalId}
                      </Link>
                      <p className="truncate">{customer ? customerLabel(customer) : <span className="text-ink-muted">{t.guest}</span>}</p>
                      <p className="type-meta text-ink-muted truncate tabular-nums">
                        {formatInstant(order.placedAt, timezone, true)}
                        {order.channel && ` · ${order.channel}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <p className="font-medium tabular-nums">{formatMoney(order.netMinor, currency)}</p>
                      <StatusChip status={order.status} labels={messages.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <TableFrame label={t.title} className="max-lg:hidden">
              <thead className="border-line bg-surface-2 border-b">
                <tr>
                  <SortHeader column="order" label={t.order} {...sort} />
                  <SortHeader column="date" label={t.date} {...sort} />
                  <th scope="col" className={th}>
                    {t.customer}
                  </th>
                  <th scope="col" className={cn(th, "max-lg:hidden")}>
                    {t.channel}
                  </th>
                  <th scope="col" className={cn(th, "text-right max-md:hidden")}>
                    {t.items}
                  </th>
                  <SortHeader column="status" label={t.status} {...sort} />
                  <SortHeader column="amount" label={t.amount} align="right" {...sort} />
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {rows.map((order) => {
                  const customer = order.customerId ? customers.get(order.customerId) : undefined;
                  return (
                    <tr key={order.id} className="hover:bg-surface-2/60 transition-colors">
                      <th scope="row" className={cn(td, "font-medium whitespace-nowrap")}>
                        <Link
                          href={hrefWith(pathname, params, { order: order.externalId })}
                          scroll={false}
                          aria-label={fill(t.open, { id: order.externalId })}
                          className="text-brand-hover inline-flex min-h-8 items-center tabular-nums underline-offset-4 hover:underline"
                        >
                          {order.externalId}
                        </Link>
                      </th>
                      <td className={cn(td, "text-ink-muted whitespace-nowrap tabular-nums")}>
                        {formatInstant(order.placedAt, timezone, true)}
                      </td>
                      <td className={cn(td, "max-w-52 truncate")}>
                        {customer ? customerLabel(customer) : <span className="text-ink-muted">{t.guest}</span>}
                      </td>
                      <td className={cn(td, "whitespace-nowrap max-lg:hidden")}>
                        {order.channel ?? <span className="text-ink-muted">{messages.table.notProvided}</span>}
                      </td>
                      <td className={cn(td, "text-right tabular-nums max-md:hidden")}>
                        {order.lines.reduce((sum, line) => sum + line.quantity, 0)}
                      </td>
                      <td className={td}>
                        <StatusChip status={order.status} labels={messages.status} />
                      </td>
                      <td className={cn(td, "text-right font-medium whitespace-nowrap tabular-nums")}>
                        {formatMoney(order.netMinor, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableFrame>
          </>
        )}
        <Pagination
          pathname={pathname}
          params={params}
          page={current}
          pageSize={TRANSACTIONS_PER_PAGE}
          total={all.length}
          labels={messages.table}
        />
      </div>

      {view.order && (
        <DetailSheet title={view.order} description={t.details} closeHref={hrefWith(pathname, params, { order: null })}>
          {open ? <OrderDetails order={open} page={page} messages={messages} /> : <p className="text-ink-muted">{t.notFound}</p>}
        </DetailSheet>
      )}
    </>
  );
}
