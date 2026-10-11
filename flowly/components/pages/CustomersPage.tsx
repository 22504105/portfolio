import { Download } from "lucide-react";
import Link from "next/link";
import { FilterBar } from "@/components/controls/FilterBar";
import {
  EmptyState,
  PageHeader,
  Pagination,
  Pill,
  SearchForm,
  SortChips,
  SortHeader,
  StatusChip,
  TableFrame,
  td,
  th,
} from "@/components/dashboard/parts";
import { DetailSheet } from "@/components/detail/DetailSheet";
import type { Customer } from "@/lib/domain/types";
import { fill, type Messages } from "@/lib/i18n";
import { customerLabel } from "@/lib/metrics/customers";
import { formatMoney } from "@/lib/money";
import { sectionHref } from "@/lib/routes";
import { formatInstant, formatRange } from "@/lib/time";
import { cn } from "@/lib/utils";
import { customerRows, CUSTOMERS_PER_PAGE, paginate } from "@/lib/view/lists";
import { hrefWith } from "@/lib/view/state";
import type { PageData } from "@/lib/workspace";

const whole = new Intl.NumberFormat("en-US");

function CustomerDetails({ customer, page, messages }: { customer: Customer; page: PageData; messages: Messages }) {
  const { context, params } = page;
  const { currency, timezone } = context.dataset.workspace;
  const t = messages.customers;
  // Everything this person ever ordered, newest first: not narrowed by the period or the filters.
  const history = context.dataset.orders.filter((order) => order.customerId === customer.id).sort((a, b) => b.placedAt - a.placedAt);
  const completed = history.filter((order) => order.status === "completed");
  const spend = completed.reduce((sum, order) => sum + order.netMinor - order.refundMinor, 0);
  const transactions = sectionHref(context.root, "transactions");

  const facts: [string, string][] = [
    [t.lifetime, formatMoney(spend, currency)],
    [t.lifetimeOrders, whole.format(completed.length)],
    [t.firstOrder, completed.length ? formatInstant(completed.at(-1)!.placedAt, timezone) : "–"],
    [t.lastOrder, completed.length ? formatInstant(completed[0].placedAt, timezone) : "–"],
  ];

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Pill tone={completed.length >= 2 ? "brand" : "neutral"}>{completed.length >= 2 ? t.repeat : t.oneTime}</Pill>
      </div>

      <dl className="card divide-line divide-y px-5 py-2">
        {/* Only what the data says. A missing name or email is shown as missing. */}
        {(
          [
            [t.id, customer.externalId],
            [t.email, customer.email],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-ink-muted">{label}</dt>
            <dd className={cn("min-w-0 truncate", !value && "text-ink-muted")}>{value ?? messages.table.notProvided}</dd>
          </div>
        ))}
        {facts.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="history-title">
        <h3 id="history-title" className="type-card">
          {t.history}
        </h3>
        <p className="type-meta text-ink-muted mt-1 mb-3">{t.historyNote}</p>
        <ul className="card divide-line divide-y px-5">
          {history.map((order) => (
            <li key={order.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={hrefWith(transactions, params, { order: order.externalId, q: null, sort: null, dir: null })}
                  aria-label={fill(messages.transactions.open, { id: order.externalId })}
                  className="text-brand-hover font-medium tabular-nums underline-offset-4 hover:underline"
                >
                  {order.externalId}
                </Link>
                <p className="type-meta text-ink-muted">{formatInstant(order.placedAt, timezone, true)}</p>
              </div>
              <StatusChip status={order.status} labels={messages.status} />
              <p className="w-20 shrink-0 text-right font-medium tabular-nums">{formatMoney(order.netMinor, currency)}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function CustomersPage({ page, messages }: { page: PageData; messages: Messages }) {
  const { context, pathname, params, view, comparison } = page;
  const { dataset } = context;
  const { currency, timezone } = dataset.workspace;
  const t = messages.customers;

  const all = customerRows(page);
  const { rows, page: current } = paginate(all, view.page, CUSTOMERS_PER_PAGE);
  const sort = { pathname, params, view, labels: messages.table };
  const open = view.customer ? dataset.customers.find((customer) => customer.id === view.customer) : undefined;
  const guests = comparison.current.anonymousOrders;

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={fill(t.subtitle, { count: whole.format(comparison.current.identifiedCustomers), range: formatRange(view.range) })}
      >
        <a
          href={hrefWith(`${context.root}/export/customers`, params, {})}
          className="rounded-input border-input bg-surface hover:bg-surface-2 inline-flex h-10 items-center gap-2 border px-3.5 font-medium transition-colors"
        >
          <Download aria-hidden="true" className="size-4" />
          {t.download}
        </a>
      </PageHeader>

      <div className="mt-6 flex flex-col gap-4">
        <FilterBar page={page} messages={messages} showStatus={false} />
        <SearchForm
          pathname={pathname}
          params={params}
          query={view.query}
          label={t.search}
          placeholder={t.searchPlaceholder}
          labels={messages.table}
        />
        {/* Orders that name nobody are said to exist and are not dressed up as people. */}
        {guests > 0 && <p className="type-meta text-ink-muted">{fill(t.guestNote, { count: whole.format(guests) })}</p>}
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
                ["spend", t.spend],
                ["orders", t.orders],
                ["lifetime", t.lifetime],
                ["last", t.lastOrder],
                ["name", t.customer],
              ]}
              {...sort}
              until="lg"
            />
            <ul className="card divide-line mt-2 divide-y lg:hidden">
              {rows.map((row) => (
                <li key={row.customer.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={hrefWith(pathname, params, { customer: row.customer.id })}
                      scroll={false}
                      aria-label={fill(t.open, { name: customerLabel(row.customer) })}
                      className="text-brand-hover inline-flex min-h-8 max-w-full items-center truncate font-medium underline-offset-4 hover:underline"
                    >
                      {customerLabel(row.customer)}
                    </Link>
                    <p className="type-meta text-ink-muted truncate tabular-nums">
                      {t.orders}: {whole.format(row.periodOrders)} · {t.lastOrder}: {formatInstant(row.lastOrderAt, timezone)}
                    </p>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      <Pill tone={row.segment === "new" ? "brand" : "neutral"}>{t[row.segment]}</Pill>
                      {row.repeat && <Pill>{t.repeat}</Pill>}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium tabular-nums">{formatMoney(row.periodSpendMinor, currency)}</p>
                    <p className="type-meta text-ink-muted tabular-nums">
                      {t.lifetime}: {formatMoney(row.lifetimeSpendMinor, currency)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <TableFrame label={t.title} className="max-lg:hidden">
              <thead className="border-line bg-surface-2 border-b">
                <tr>
                  <SortHeader column="name" label={t.customer} {...sort} />
                  <SortHeader column="orders" label={t.orders} align="right" {...sort} />
                  <SortHeader column="spend" label={t.spend} align="right" {...sort} />
                  <SortHeader column="lifetime" label={t.lifetime} align="right" {...sort} />
                  <SortHeader column="last" label={t.lastOrder} {...sort} />
                  <th scope="col" className={th}>
                    {t.segment}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {rows.map((row) => (
                  <tr key={row.customer.id} className="hover:bg-surface-2/60 transition-colors">
                    <th scope="row" className={cn(td, "max-w-64 font-normal")}>
                      <Link
                        href={hrefWith(pathname, params, { customer: row.customer.id })}
                        scroll={false}
                        aria-label={fill(t.open, { name: customerLabel(row.customer) })}
                        className="text-brand-hover block truncate font-medium underline-offset-4 hover:underline"
                      >
                        {customerLabel(row.customer)}
                      </Link>
                      <span className="type-meta text-ink-muted block truncate">
                        {row.customer.email ?? row.customer.externalId ?? messages.table.notProvided}
                      </span>
                    </th>
                    <td className={cn(td, "text-right tabular-nums")}>{whole.format(row.periodOrders)}</td>
                    <td className={cn(td, "text-right font-medium whitespace-nowrap tabular-nums")}>
                      {formatMoney(row.periodSpendMinor, currency)}
                    </td>
                    <td className={cn(td, "text-right whitespace-nowrap tabular-nums")}>{formatMoney(row.lifetimeSpendMinor, currency)}</td>
                    <td className={cn(td, "text-ink-muted whitespace-nowrap tabular-nums")}>{formatInstant(row.lastOrderAt, timezone)}</td>
                    <td className={td}>
                      <span className="flex flex-wrap gap-1.5">
                        <Pill tone={row.segment === "new" ? "brand" : "neutral"}>{t[row.segment]}</Pill>
                        {row.repeat && <Pill>{t.repeat}</Pill>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
          </>
        )}
        <Pagination
          pathname={pathname}
          params={params}
          page={current}
          pageSize={CUSTOMERS_PER_PAGE}
          total={all.length}
          labels={messages.table}
        />
      </div>

      {view.customer && (
        <DetailSheet
          title={open ? customerLabel(open) : t.details}
          description={t.details}
          closeHref={hrefWith(pathname, params, { customer: null })}
        >
          {open ? <CustomerDetails customer={open} page={page} messages={messages} /> : <p className="text-ink-muted">{t.notFound}</p>}
        </DetailSheet>
      )}
    </>
  );
}
