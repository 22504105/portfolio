"use client";

import { useEffect } from "react";

// Registers the service worker, in production only: in development it would
// hold on to files that change on every save.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // The site works without it; there is nothing to tell the visitor.
    });
  }, []);

  return null;
}
