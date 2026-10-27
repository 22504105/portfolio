"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Suspense, useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { THEME_KEY as KEY } from "./theme-script";

// Light, dark, or whatever the device prefers. The choice is kept in the
// browser (nothing is sent anywhere) and applied to <html data-theme> by a
// small script in the document head before the page is painted, so a dark
// page never flashes white first. See THEME_SCRIPT in ./theme-script.ts.

export type ThemeChoice = "light" | "dark" | "system";
const ORDER: readonly ThemeChoice[] = ["light", "dark", "system"];

const listeners = new Set<() => void>();

function stored(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    // Storage can be blocked; the page then simply follows the device.
    return "system";
  }
}

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

function apply(choice: ThemeChoice) {
  document.documentElement.dataset.theme = choice === "system" ? (prefersDark() ? "dark" : "light") : choice;
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/**
 * Keeps <html data-theme> true to the choice. The script in the head sets it
 * before the first paint; this sets it again once React has taken over the
 * page, and whenever the choice changes elsewhere.
 *
 * It is needed because React owns the <html> element: when it has to draw the
 * page afresh in the browser instead of adopting the server's markup (which
 * happens on a slow device if something updates before loading has finished),
 * it clears the attributes it did not put there, the theme among them.
 */
export function ThemeKeeper() {
  useEffect(() => {
    const sync = () => {
      apply(stored());
      for (const notify of listeners) notify();
    };
    sync();
    // Another tab changed the choice, or the device switched between day and night.
    const onStorage = (event: StorageEvent) => event.key === KEY && sync();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("storage", onStorage);
    media.addEventListener("change", sync);
    // If the attribute is ever taken away, put it back.
    const guard = new MutationObserver(() => {
      if (!document.documentElement.dataset.theme) apply(stored());
    });
    guard.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      window.removeEventListener("storage", onStorage);
      media.removeEventListener("change", sync);
      guard.disconnect();
    };
  }, []);
  return null;
}

function choose(choice: ThemeChoice) {
  try {
    if (choice === "system") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, choice);
  } catch {
    // Not remembered, but still applied for this visit.
  }
  apply(choice);
  for (const notify of listeners) notify();
}

export type ThemeLabels = { label: string; light: string; dark: string; system: string; current: string };

type ThemeToggleProps = {
  labels: ThemeLabels;
  /** On the dark sidebar and other dark surfaces. */
  onDark?: boolean;
  /** Three named buttons side by side (for Settings) instead of one button that cycles. */
  expanded?: boolean;
  className?: string;
};

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

function Toggle({ labels, onDark = false, expanded = false, className }: ThemeToggleProps) {
  // On the server, and until the browser has been asked, the choice is unknown: "system" is the honest default.
  const choice = useSyncExternalStore<ThemeChoice>(subscribe, stored, () => "system");

  if (expanded) {
    return (
      <div
        role="radiogroup"
        aria-label={labels.label}
        className={cn("rounded-input border-input bg-surface inline-flex border p-0.5", className)}
      >
        {ORDER.map((option) => {
          const Icon = ICONS[option];
          const active = choice === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(option)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-[8px] px-3.5 transition-colors",
                active ? "bg-brand-tint text-brand-hover font-medium" : "text-ink-muted hover:text-ink",
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {labels[option]}
            </button>
          );
        })}
      </div>
    );
  }

  const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
  const Icon = ICONS[choice];
  return (
    <button
      type="button"
      onClick={() => choose(next)}
      // Says what it is now and what pressing it does.
      aria-label={`${labels.label}: ${labels[choice]}. ${labels.current} ${labels[next]}`}
      title={`${labels.label}: ${labels[choice]}`}
      className={cn(
        "rounded-input inline-flex size-10 shrink-0 items-center justify-center border transition-colors",
        onDark ? "text-nav-ink border-white/15 hover:bg-white/10" : "border-input bg-surface text-ink hover:bg-surface-2",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-[18px]" />
    </button>
  );
}

export function ThemeToggle(props: ThemeToggleProps) {
  return (
    <Suspense fallback={null}>
      <Toggle {...props} />
    </Suspense>
  );
}
