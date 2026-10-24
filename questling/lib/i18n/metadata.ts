import type { Metadata } from "next";
import { fill, getDictionary, isLocale, type Dictionary } from "./index";

// A page's <title> in the interface language: "Награды — Questling (демо)", "Rewards — Questling".
export function pageMetadata(mode: "demo" | "app", title: (t: Dictionary) => string) {
  return async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
    const { locale } = await params;
    if (!isLocale(locale)) return {};
    const t = getDictionary(locale);
    return { title: mode === "demo" ? fill(t.meta.demoTitle, { page: title(t) }) : fill(t.meta.appTitle, { page: title(t) }) };
  };
}
