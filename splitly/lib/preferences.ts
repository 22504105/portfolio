import { isCurrencyCode } from "@/lib/money/currency";

// What a person prefers, kept on their device only: nothing here is sent anywhere.

const CURRENCY_KEY = "splitly-currency-v1";
const FAVOURITES_KEY = "splitly-favourites-v1";
const SEEN_KEY = "splitly-activity-seen-v1";
/** Told to the page when one of these changes, so that every part showing it follows at once. */
const CHANGED = "splitly-preferences";

/** The currency offered first for a new group: the one they chose, or lira. */
export function preferredCurrency(): string {
  try {
    const stored = window.localStorage.getItem(CURRENCY_KEY);
    return isCurrencyCode(stored) ? stored : "TRY";
  } catch {
    return "TRY";
  }
}

export function rememberCurrency(currency: string): void {
  try {
    window.localStorage.setItem(CURRENCY_KEY, currency);
  } catch {
    // No storage: the choice holds until the page is closed.
  }
}

function read(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // No storage: nothing is remembered, and nothing breaks.
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** Calls back when a preference changes, here or in another tab. */
export function subscribePreferences(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The stored list of favourite groups, as the text it is kept as: the same text means nothing changed. */
export const favouritesText = () => read(FAVOURITES_KEY);

/** The IDs in that text. Anything that is not a list of short texts is taken as no favourites. */
export function parseFavourites(text: string): string[] {
  try {
    const value: unknown = JSON.parse(text || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id.length <= 100).slice(0, 200) : [];
  } catch {
    return [];
  }
}

export function toggleFavourite(groupId: string): void {
  const now = parseFavourites(favouritesText());
  write(FAVOURITES_KEY, JSON.stringify(now.includes(groupId) ? now.filter((id) => id !== groupId) : [...now, groupId]));
}

/** Favourites first, each side keeping the order it came in. */
export function favouritesFirst<T extends { id: string }>(groups: readonly T[], favourites: ReadonlySet<string>): T[] {
  return [...groups.filter((group) => favourites.has(group.id)), ...groups.filter((group) => !favourites.has(group.id))];
}

/** When this person last said they had read the activity, as an ISO time; empty if never. */
export const activitySeenText = () => read(SEEN_KEY);

export function rememberActivitySeen(at: string): void {
  write(SEEN_KEY, at);
}
