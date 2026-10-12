"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Suspense, useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

// Light, dark, or whatever the device (or Telegram) prefers. The choice is
// kept in the browser and applied to <html data-theme> by a small script in
// the document head before the page is painted, so a dark page never flashes
// white first. See THEME_SCRIPT below.

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "splitly-theme";
const ORDER: readonly ThemeChoice[] = ["system", "light", "dark"];

const listeners = new Set<() => void>();

function stored(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    // Storage can be blocked, in an embedded page especially; the page then follows the device.
    return "system";
  }
}

type TelegramWindow = Window & { Telegram?: { WebApp?: { colorScheme?: string } } };

/** What "same as device" means right now: Telegram's own theme inside Telegram, the system's elsewhere. */
function deviceDark(): boolean {
  const telegram = (window as TelegramWindow).Telegram?.WebApp?.colorScheme;
  if (telegram === "dark" || telegram === "light") return telegram === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(choice: ThemeChoice) {
  document.documentElement.dataset.theme = choice === "system" ? (deviceDark() ? "dark" : "light") : choice;
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
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

/**
 * Keeps <html data-theme> true to the choice. The script in the head sets it
 * before the first paint; this sets it again once React has taken over, and
 * whenever the choice changes elsewhere.
 *
 * It is needed because React owns the <html> element: when it has to draw the
 * page afresh in the browser instead of adopting the server's markup (which
 * happens on a slow phone if something updates before loading has finished),
 * it clears the attributes it did not put there, the theme among them.
 */
export function ThemeKeeper() {
  useEffect(() => {
    const sync = () => {
      apply(stored());
      for (const notify of listeners) notify();
    };
    sync();
    const onStorage = (event: StorageEvent) => event.key === KEY && sync();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("storage", onStorage);
    media.addEventListener("change", sync);
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

export type ThemeLabels = { label: string; light: string; dark: string; system: string; switchTo: string };

type ThemeToggleProps = {
  labels: ThemeLabels;
  /** Three named buttons side by side (for the profile) instead of one button that cycles. */
  expanded?: boolean;
  className?: string;
};

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

function Toggle({ labels, expanded = false, className }: ThemeToggleProps) {
  // On the server, and until the browser has been asked, the choice is unknown: "system" is the honest default.
  const choice = useSyncExternalStore<ThemeChoice>(subscribe, stored, () => "system");

  if (expanded) {
    return (
      <div
        role="radiogroup"
        aria-label={labels.label}
        className={cn("rounded-control border-field bg-surface grid grid-cols-3 gap-1 border p-1", className)}
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
                "type-small flex min-h-11 flex-col items-center justify-center gap-1 rounded-[9px] px-2 py-2 text-center transition-colors",
                active ? "bg-accent text-on-accent font-semibold" : "text-ink-muted hover:text-ink",
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
      aria-label={`${labels.label}: ${labels[choice]}. ${labels.switchTo} ${labels[next]}`}
      title={`${labels.label}: ${labels[choice]}`}
      className={cn(
        "rounded-control border-field bg-surface text-ink hover:bg-surface-2 inline-flex size-11 shrink-0 items-center justify-center border transition-colors",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-[18px]" />
    </button>
  );
}

/** The switch, in a boundary of its own: pressing it early redraws the switch, never the whole page. */
export function ThemeToggle(props: ThemeToggleProps) {
  return (
    <Suspense fallback={null}>
      <Toggle {...props} />
    </Suspense>
  );
}

/**
 * Runs in the document head before anything is drawn: reads the stored choice
 * and sets data-theme. Kept as a string because it must not wait for React.
 */
export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem("${KEY}");var d=c==="dark"||(c!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}})()`;
