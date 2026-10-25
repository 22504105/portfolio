import type { Metadata } from "next";
import { fill, getDictionary, isLocale, type Dictionary } from "./index";
import { studioDictionary, type StudioDictionary } from "./studio";

// A page's <title> in the interface language: "Награды — Questling (демо)", "Rewards — Questling".
export function pageMetadata(mode: "demo" | "app", title: (t: Dictionary) => string) {
  return async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
    const { locale } = await params;
    if (!isLocale(locale)) return {};
    const t = getDictionary(locale);
    return { title: mode === "demo" ? fill(t.meta.demoTitle, { page: title(t) }) : fill(t.meta.appTitle, { page: title(t) }) };
  };
}

/** A Teacher Studio page's <title>: "Обзор — Questling Teacher Studio", or the demo's. */
export function studioMetadata(mode: "demo" | "live", title: (t: StudioDictionary) => string) {
  return async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
    const { locale } = await params;
    if (!isLocale(locale)) return {};
    const t = studioDictionary(locale);
    // The studio is for teachers: nothing in it is for search engines.
    return { title: fill(mode === "demo" ? t.meta.demoTitle : t.meta.title, { page: title(t) }), robots: { index: false, follow: false } };
  };
}
