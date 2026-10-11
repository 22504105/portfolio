"use client";

import { CalendarDays, Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fill, type Messages } from "@/lib/i18n";
import { formatDay, formatRange, isDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import { defaultRange, hrefWith, presets, sameRange, type Calendar } from "@/lib/view/state";

type PeriodPickerProps = { calendar: Calendar; labels: Messages["period"] };

const chip =
  "inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-input border border-line bg-surface px-3 text-ink transition-colors";
const field = "h-10 w-full rounded-input border border-input bg-surface px-3 text-ink tabular-nums";

function Picker({ calendar, labels }: PeriodPickerProps) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const params = Object.fromEntries(search.entries());
  const from = search.get("from");
  const to = search.get("to");
  const range = isDay(from) && isDay(to) && from <= to ? { from, to } : defaultRange(calendar);
  const href = (next: { from: string; to: string }) => hrefWith(pathname, params, next);

  const applyCustom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = { from: String(form.get("from")), to: String(form.get("to")) };
    if (!isDay(next.from) || !isDay(next.to) || next.from > next.to) return setInvalid(true);
    setInvalid(false);
    setOpen(false);
    router.push(href(next));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn(chip, "hover:bg-surface-2")} aria-label={`${labels.change}: ${formatRange(range)}`}>
        <CalendarDays aria-hidden="true" className="text-ink-muted size-4" />
        <span className="tabular-nums">{formatRange(range)}</span>
        <ChevronDown aria-hidden="true" className="text-ink-muted size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="rounded-card w-[min(20rem,calc(100vw-2rem))] gap-0 p-2">
        <ul aria-label={labels.presets}>
          {presets(calendar).map((preset) => {
            const active = sameRange(preset.range, range);
            return (
              <li key={preset.key}>
                <Link
                  href={href(preset.range)}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "hover:bg-surface-2 flex min-h-10 items-center justify-between gap-3 rounded-[8px] px-3 transition-colors",
                    active && "bg-brand-tint text-brand-hover hover:bg-brand-tint font-medium",
                  )}
                >
                  {labels[preset.key as keyof typeof labels]}
                  {active && <Check aria-hidden="true" className="size-4" />}
                </Link>
              </li>
            );
          })}
        </ul>

        <form onSubmit={applyCustom} className="border-line mt-2 border-t px-3 pt-3 pb-2" noValidate>
          <p className="font-medium">{labels.custom}</p>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <label className="type-meta text-ink-muted">
              {labels.from}
              <input
                key={`from-${range.from}`}
                type="date"
                name="from"
                defaultValue={range.from}
                min={calendar.firstDay}
                max={calendar.lastDay}
                required
                className={cn(field, "mt-1")}
              />
            </label>
            <label className="type-meta text-ink-muted">
              {labels.to}
              <input
                key={`to-${range.to}`}
                type="date"
                name="to"
                defaultValue={range.to}
                min={calendar.firstDay}
                max={calendar.lastDay}
                required
                className={cn(field, "mt-1")}
              />
            </label>
          </div>
          {invalid && (
            <p role="alert" className="type-meta text-negative mt-2">
              {labels.invalid}
            </p>
          )}
          <p className="type-meta text-ink-muted mt-2">
            {fill(labels.dataNote, { from: formatDay(calendar.firstDay), to: formatDay(calendar.lastDay) })}
          </p>
          <button
            type="submit"
            className="rounded-input bg-brand hover:bg-brand-strong mt-3 inline-flex h-10 w-full items-center justify-center font-medium text-white transition-colors"
          >
            {labels.apply}
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** The period every page is showing, and the way to change it. It is kept in the address. */
export function PeriodPicker(props: PeriodPickerProps) {
  // Until the address is known (while a static page is being prepared), show the default period as plain text.
  const fallback = (
    <p className={chip}>
      <CalendarDays aria-hidden="true" className="text-ink-muted size-4" />
      <span className="tabular-nums">{formatRange(defaultRange(props.calendar))}</span>
    </p>
  );
  return (
    <Suspense fallback={fallback}>
      <Picker {...props} />
    </Suspense>
  );
}
