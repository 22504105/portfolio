import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ru from "@/messages/ru.json";

type Catalog = { [key: string]: string | Catalog };

/** Every message as "path.to.key" -> text. */
function flatten(catalog: Catalog, prefix = ""): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") entries.set(path, value);
    else for (const [inner, text] of flatten(value, path)) entries.set(inner, text);
  }
  return entries;
}

// Arguments only: `{name}` and `{count, plural, ...}`. The words inside a plural's
// branches differ between languages, as do the branches themselves.
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\s*[,}]/g)].map((match) => match[1]).sort();

describe("message catalogs", () => {
  const english = flatten(en);
  const russian = flatten(ru);

  it("have the same keys in English and Russian", () => {
    expect([...russian.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("have no empty messages", () => {
    const empty = [...english, ...russian].filter(([, text]) => !text.trim()).map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it("use the same placeholders in both languages", () => {
    const mismatched = [...english.keys()].filter(
      (key) => placeholders(english.get(key)!).join() !== placeholders(russian.get(key) ?? "").join(),
    );
    expect(mismatched).toEqual([]);
  });

  it("leave no Russian message in English", () => {
    // Brand and language names are the same in both catalogs on purpose.
    const sameOnPurpose = new Set(["brand.name", "footer.rights", "admin.clients.never", "admin.analytics.range", "locale.en", "locale.ru", "locale.shortEn", "locale.shortRu"]);
    const untranslated = [...russian].filter(([key, text]) => !sameOnPurpose.has(key) && !/[а-яё]/i.test(text)).map(([key]) => key);
    expect(untranslated).toEqual([]);
  });
});
