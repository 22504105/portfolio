# Flowly — Metric definitions

Each figure Flowly shows, in words. `lib/metrics` implements exactly these and
`tests/metrics.test.ts` checks them against a week worked out by hand. The
report page prints the same definitions as footnotes.

## What an order is

An order is one purchase, identified by its order number, with one or more
lines (products). Its amounts are the sums of its lines:

- **gross** = quantity × unit price
- **discount** ≥ 0
- **net** = gross − discount

An order has one status:

| Status    | Meaning                       | In revenue                   | In order count |
| --------- | ----------------------------- | ---------------------------- | -------------- |
| completed | Paid and not withdrawn        | Yes, less any partial refund | Yes            |
| refunded  | Paid, then given back in full | No                           | No             |
| cancelled | Never went through            | No                           | No             |
| pending   | Not settled yet               | No                           | No             |

**Refunds.** A full refund is the status `refunded`. A partial refund is a
`refund_amount` on a completed order (0 ≤ refund ≤ net). Negative-amount rows
are not used to represent refunds; an import that contains them is asked to
map them explicitly.

## Figures

| Figure                   | Definition                                                                                                          | When there is nothing to divide by |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Net revenue**          | Σ (net − refund) over completed orders                                                                              | 0                                  |
| **Completed orders**     | Number of completed orders. An order with five lines is one order                                                   | 0                                  |
| **Average order value**  | Net revenue ÷ completed orders, rounded to a whole minor unit                                                       | `N/A`                              |
| **Identified customers** | Distinct known customers with at least one completed order in the range                                             | 0                                  |
| **Guest orders**         | Completed orders that name no customer. They are orders and revenue, never customers                                | 0                                  |
| **Repeat customer rate** | Identified customers with two or more completed orders **in the range** ÷ identified customers in the range         | `N/A`                              |
| **Refunded**             | Σ net of refunded orders + Σ partial refunds                                                                        | 0                                  |
| **Conversion rate**      | Not calculated: it needs visits, and Flowly has no traffic data. Shown as "Unavailable — traffic data not provided" | —                                  |

## Period and comparison

- A period is a range of calendar days, both ends included, in the
  **workspace time zone**. An order placed at 23:30 on the 31st in New York
  belongs to the 31st although it is the 1st in UTC.
- Day counts ignore daylight saving: a range is as many days as the calendar
  says.
- **Comparison** is with the range of the same number of days that ends the
  day before the period begins, seen through the same filters.
- A change is shown as an absolute difference and a percentage of the earlier
  value. When the earlier value is zero there is no percentage, and none is
  shown. When either side has no value (`N/A`), there is no change at all.

## Money and currency

- All amounts in a workspace are in its one currency; a file with another
  currency is rejected, never summed.
- Amounts are parsed as decimals and held as whole minor units (cents for
  USD, whole yen for JPY). Rounding, where a file has more decimals than the
  currency, is half-up at import.
- Changing a workspace's currency is not possible while it has orders.

## Filters

- **Status** and **channel** keep or drop whole orders.
- **Category** and **product** work on lines: an order that matches keeps only
  its matching lines, and its amounts are those of the lines that remain.
- A partial refund is shared between an order's lines in proportion to their
  net, in whole minor units, the remainder on the last line, so the shares
  always add up to the refund.
- The comparison period is seen through the same filters as the period.

## Breakdowns

Revenue by channel, category and product, from completed orders only, so the
rows of any breakdown add up to net revenue exactly (tested).

- By channel, an order is in one row. By category or product, a line's revenue
  is its net less its share of any refund, and an order with several products
  is counted in each of their rows; that column therefore does not add up to
  the order count, and the page says so.
- A missing channel, category or product is grouped as "Not provided", never
  dropped.

## Over time

A bucket is a day, a week (Monday to Sunday) or a calendar month, cut off at
the ends of the period, so the buckets add up to the period's totals
(tested). The default is days up to 45 days, weeks up to 200, months beyond.

## Customers

- Listed: identified customers with a completed order in the period, under
  the filters. Their number is the headline "Identified customers" (tested).
- **Orders** and **Spend** are for the period; **Lifetime spend**, **Last
  order** and the order history are for all time, unfiltered.
- **New**: the customer's first completed order ever falls inside the period.
  **Returning**: it came before. **Repeat buyer**: two or more completed
  orders ever.
- Spend of the listed customers plus revenue from guest orders equals net
  revenue (tested).
