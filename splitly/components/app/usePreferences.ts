"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  activitySeenText,
  favouritesText,
  parseFavourites,
  rememberActivitySeen,
  subscribePreferences,
  toggleFavourite,
} from "@/lib/preferences";

// What is kept on the device, for a screen to read and follow. While a page is
// being prepared there is no device, so everything starts empty and fills in
// once the page is alive.

/** The groups this person keeps at the top, on this device. */
export function useFavourites(): { favourites: ReadonlySet<string>; toggle: (groupId: string) => void } {
  const text = useSyncExternalStore(subscribePreferences, favouritesText, () => "");
  const favourites = useMemo(() => new Set(parseFavourites(text)), [text]);
  return { favourites, toggle: toggleFavourite };
}

/**
 * When this person last marked the activity as read. The first time Splitly
 * is opened on a device that moment is now: what happened before is not news.
 * `loaded` says the groups have been read: only then is "now" after everything
 * that is already there.
 */
export function useActivitySeen(loaded: boolean): { seen: string | null; markRead: () => void } {
  const text = useSyncExternalStore(subscribePreferences, activitySeenText, () => "");
  useEffect(() => {
    if (loaded && !activitySeenText()) rememberActivitySeen(new Date().toISOString());
  }, [loaded]);
  return { seen: text || null, markRead: () => rememberActivitySeen(new Date().toISOString()) };
}
