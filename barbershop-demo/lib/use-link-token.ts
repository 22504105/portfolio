"use client";

import { useEffect, useSyncExternalStore } from "react";

// Email links carry their token after the "#": /booking/confirm#token=...
// The part of an address after "#" is never sent to a server, so the token
// stays out of access logs and Referer headers, and out of anything that
// records the addresses of requests. The page reads it here, in the browser,
// and hands it to a server action in the body of a POST.

// Kept for the life of the page: the token is removed from the address bar as
// soon as it has been read, and must still be there for the button press.
let captured = "";

const subscribe = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};

function fromHash(): string {
  const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
  if (token) captured = token;
  return captured;
}

/**
 * The token of the link that opened the page: `null` until the browser has
 * been asked (on the server, always), then the token, or "" if the link had
 * none. Once read it is removed from the address bar, so it does not linger
 * in the history or in a screenshot.
 */
export function useLinkToken(): string | null {
  const token = useSyncExternalStore(subscribe, fromHash, () => null);

  useEffect(() => {
    if (token && window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [token]);

  return token;
}
