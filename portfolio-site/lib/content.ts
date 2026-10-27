import { readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import type { Lang } from "./i18n";

export type Section = { title: string; html: string };

// Sections the site shows in its own way (gallery, contact block) or that repeat the tagline.
const skipped = new Set(["Screenshots", "Short summary", "Contact", "Скриншоты", "Коротко", "Контакты"]);

/** Reads a case study copied from `showcase/` by `npm run sync` and splits it into sections. */
export async function caseStudy(slug: string, lang: Lang): Promise<Section[]> {
  const md = await readFile(path.join(process.cwd(), "content", slug, `${lang}.md`), "utf8");
  return md
    .split(/^## /m)
    .slice(1)
    .map((chunk) => {
      const [title, ...rest] = chunk.split("\n");
      return { title: title.trim(), body: rest.join("\n").trim() };
    })
    .filter((s) => !skipped.has(s.title))
    .map((s) => ({ title: s.title, html: marked.parse(s.body, { async: false }) }));
}
