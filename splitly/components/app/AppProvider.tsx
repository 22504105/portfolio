"use client";

import { CircleCheck } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { createDemoStore, type Shelf } from "@/lib/store/demo";
import { StoreError, type Store, type StoreErrorCode } from "@/lib/store/types";

// What every screen of the app can reach: where its data lives (the demo's
// browser storage or the server), its words, and a way to say "saved".

export type Account = {
  displayName: string;
  /** Their Telegram photo, if any. */ photoUrl: string | null;
  /** The bot's @name, for invitation links. */ bot: string | null;
  remove(): Promise<void>;
};

type App = {
  store: Store;
  /** Where the app lives, e.g. "/en/demo". */
  base: string;
  locale: Locale;
  t: Dictionary;
  /** Goes up whenever something was changed, so that what is on screen is read again. */
  revision: number;
  changed(): void;
  /** A short confirmation, shown for a few seconds and read out by screen readers. */
  notify(message: string): void;
  account?: Account;
  resetDemo?: () => void;
};

const Context = createContext<App | null>(null);

export function useApp(): App {
  const app = useContext(Context);
  if (!app) throw new Error("useApp must be used inside an AppProvider.");
  return app;
}

type ProviderProps = {
  /** Called with every confirmation: inside Telegram, a tap in the hand. */
  onNotify?: () => void;
  store: Store;
  base: string;
  locale: Locale;
  dictionary: Dictionary;
  account?: Account;
  resetDemo?: () => void;
  children: ReactNode;
};

export function AppProvider({ store, base, locale, dictionary, account, resetDemo, onNotify, children }: ProviderProps) {
  const [revision, setRevision] = useState(0);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const changed = useCallback(() => setRevision((value) => value + 1), []);
  const notify = useCallback(
    (text: string) => {
      clearTimeout(timer.current);
      setToast({ id: Date.now(), text });
      onNotify?.();
      timer.current = setTimeout(() => setToast(null), 4000);
    },
    [onNotify],
  );
  useEffect(() => () => clearTimeout(timer.current), []);

  const app = useMemo(
    () => ({ store, base, locale, t: dictionary, revision, changed, notify, account, resetDemo }),
    [store, base, locale, dictionary, revision, changed, notify, account, resetDemo],
  );

  return (
    <Context.Provider value={app}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--spacing-nav)+env(safe-area-inset-bottom)+1.5rem)] z-40 flex justify-center px-4 md:bottom-8"
      >
        {toast && (
          <p
            key={toast.id}
            className="bg-ink text-canvas shadow-raised type-small flex items-center gap-2 rounded-full px-4 py-2.5 font-semibold"
          >
            <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
            {toast.text}
          </p>
        )}
      </div>
    </Context.Provider>
  );
}

// The browser's own storage, reached only when something is read or written:
// never while the page is being prepared on the server.
const browserShelf: Shelf = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};

/** The browser demo: invented groups, kept in this browser and sent nowhere. */
export function DemoProvider({ locale, dictionary, children }: { locale: Locale; dictionary: Dictionary; children: ReactNode }) {
  const store = useMemo(() => createDemoStore(browserShelf, locale), [locale]);
  return (
    <AppProvider store={store} base={`/${locale}/demo`} locale={locale} dictionary={dictionary} resetDemo={store.reset}>
      {children}
    </AppProvider>
  );
}

type Loaded<T> = { data: T | undefined; error: StoreErrorCode | null; loading: boolean };

/**
 * Reads something from the store, and reads it again whenever anything was
 * changed. What was on screen stays there while the new answer is on its way.
 */
export function useLoad<T>(load: (store: Store) => Promise<T>, key: string): Loaded<T> {
  const { store, revision } = useApp();
  const [state, setState] = useState<Loaded<T> & { key: string }>({ data: undefined, error: null, loading: true, key });
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });

  useEffect(() => {
    let current = true;
    latest
      .current(store)
      .then((data) => current && setState({ data, error: null, loading: false, key }))
      .catch(
        (error: unknown) =>
          current && setState({ data: undefined, error: error instanceof StoreError ? error.code : "server_error", loading: false, key }),
      );
    return () => {
      current = false;
    };
  }, [store, revision, key]);

  // An answer to a different question (another group's page) is not shown as this one's.
  return state.key === key ? state : { data: undefined, error: null, loading: true };
}

/** The message for whatever went wrong. */
export function errorText(t: Dictionary, error: unknown): string {
  const code = error instanceof StoreError ? error.code : typeof error === "string" ? error : "server_error";
  return t.errors[code as keyof Dictionary["errors"]] ?? t.errors.server_error;
}
