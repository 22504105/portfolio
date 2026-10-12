"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { hexOf } from "@/lib/colour";

// Splitly inside Telegram's own frame: Telegram's back button instead of a
// second one, Telegram's header in the page's own colour, and a tap in the
// hand when something is saved. Every call is optional: older Telegram
// clients lack some of them, and outside Telegram none exist.

type Chrome = {
  BackButton?: { show?: () => void; hide?: () => void; onClick?: (handler: () => void) => void; offClick?: (handler: () => void) => void };
  HapticFeedback?: { notificationOccurred?: (kind: "success" | "error" | "warning") => void };
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  isVersionAtLeast?: (version: string) => boolean;
};

const chrome = (): Chrome | undefined => (window as Window & { Telegram?: { WebApp?: Chrome } }).Telegram?.WebApp;

/** A tap for "saved". Does nothing where there is no Telegram or no such thing. */
export function tapSuccess() {
  try {
    chrome()?.HapticFeedback?.notificationOccurred?.("success");
  } catch {
    // A client that claims the method and then refuses it: nothing is lost.
  }
}

export function TelegramChrome({ base }: { base: string }) {
  const router = useRouter();
  const pathname = usePathname();

  // Telegram's back arrow on every screen but the first, going back the way the person came.
  useEffect(() => {
    const button = chrome()?.BackButton;
    if (!button?.show || !button.onClick) return;
    const back = () => (window.history.length > 1 ? router.back() : router.replace(base));
    try {
      if (pathname === base) button.hide?.();
      else {
        button.onClick(back);
        button.show();
      }
    } catch {
      return;
    }
    return () => {
      try {
        button.offClick?.(back);
      } catch {
        // Already gone with the client.
      }
    };
  }, [pathname, base, router]);

  // Telegram's header and the strip behind the page take the page's own colour, and follow the theme when it changes.
  useEffect(() => {
    const app = chrome();
    if (!app?.setHeaderColor) return;
    const paint = () => {
      const color = hexOf(getComputedStyle(document.body).backgroundColor);
      if (!color) return;
      try {
        app.setHeaderColor?.(color);
        app.setBackgroundColor?.(color);
        if (app.isVersionAtLeast?.("7.10")) app.setBottomBarColor?.(color);
      } catch {
        // An older client: it keeps its own colours.
      }
    };
    paint();
    const watcher = new MutationObserver(paint);
    watcher.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => watcher.disconnect();
  }, []);

  return null;
}
