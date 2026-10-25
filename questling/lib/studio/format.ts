import { plural, fill, type Locale } from "@/lib/i18n";
import type { StudioDictionary } from "@/lib/i18n/studio";

// Small wordings for Teacher Studio: how long ago, the school year.

export function timeAgo(t: StudioDictionary, locale: Locale, at: string, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - Date.parse(at)) / 60_000));
  if (minutes < 1) return t.common.justNow;
  if (minutes < 60) return fill(t.common.minutesAgo, { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return plural(locale, hours, t.common.hoursAgo);
  return plural(locale, Math.round(hours / 24), t.common.daysAgo);
}

/** "2026–2027": a school year starts in September. */
export function schoolYear(now: Date): string {
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 8 ? `${year}–${year + 1}` : `${year - 1}–${year}`;
}

/** "+18%" / "−6%". */
export const signed = (n: number) => (n > 0 ? `+${n}%` : n < 0 ? `−${Math.abs(n)}%` : "0%");

/** Saves text as a file in the browser (the gradebook's CSV). */
export function download(name: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
