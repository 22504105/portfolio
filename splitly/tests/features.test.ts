import { describe, expect, it, vi } from "vitest";
import { countNew, eventsOf, isNew } from "@/lib/activity";
import type { Group } from "@/lib/domain/types";
import { handOver } from "@/lib/export/backup";
import { OFFERED_CURRENCIES, rateQuery, readOffer } from "@/lib/money/auto-rate";
import { favouritesFirst, parseFavourites } from "@/lib/preferences";
import { FAMILY_OF, fold, PICTURES, pictureOf } from "@/lib/receipt/pictures";
import { createDemoStore, type Shelf } from "@/lib/store/demo";

// The parts of the approved additions that are plain reckoning: which picture
// a receipt line gets, what an offered exchange rate is taken to be, which
// events are news to a person, and the order favourites put groups in.

describe("the picture beside a receipt line", () => {
  it("is found by the words of the name, in Turkish, Russian and English, however they are written", () => {
    expect(pictureOf("SÜT 1L")).toBe("milk");
    expect(pictureOf("Молоко 3,2%")).toBe("milk");
    expect(pictureOf("ESKİ KAŞAR PEYNİR")).toBe("milk");
    expect(pictureOf("TAVUK GÖĞSÜ 750G")).toBe("chicken");
    expect(pictureOf("Куриное филе")).toBe("chicken");
    expect(pictureOf("EKMEK 2x")).toBe("bread");
    expect(pictureOf("Хлеб бородинский")).toBe("bread");
    expect(pictureOf("DETERJAN SIVI 2L")).toBe("cleaning");
    expect(pictureOf("Yumurta 10'lu")).toBe("eggs");
    expect(pictureOf("Domates kg")).toBe("vegetables");
    expect(pictureOf("Яблоки Гренни")).toBe("fruit");
    expect(pictureOf("Cappuccino")).toBe("coffee");
    expect(pictureOf("Efes Pilsen 50cl")).toBe("beer");
    expect(pictureOf("Baklava fıstıklı")).toBe("sweets");
    expect(pictureOf("Шампунь")).toBe("hygiene");
  });

  it("puts the more particular kind first, takes whole words where a part would mislead, and never guesses", () => {
    expect(pictureOf("Ice cream vanilla")).toBe("iceCream");
    expect(pictureOf("Hamburger menu")).toBe("meal");
    expect(pictureOf("Ham 200g")).toBe("meat");
    expect(pictureOf("Line 3")).toBe("other");
    expect(pictureOf("")).toBe("other");
    expect(pictureOf("XK-4471")).toBe("other");
    expect(fold("SÜT-1L ёж")).toBe(" sut 1l еж ");
    // Every picture belongs to a family, so every one has a tint.
    expect(PICTURES.every((picture) => FAMILY_OF[picture])).toBe(true);
  });
});

describe("an exchange rate offered from the bank's table", () => {
  it("is asked for only for pairs the table has", () => {
    expect(rateQuery("EUR", "TRY")).toBe("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=TRY");
    expect(rateQuery("EUR", "EUR")).toBeNull();
    expect(rateQuery("RUB", "TRY")).toBeNull();
    expect(rateQuery("EUR", "KZT")).toBeNull();
    expect(rateQuery("eur", "TRY")).toBeNull();
    expect(rateQuery("EUR&x=1", "TRY")).toBeNull();
    expect(rateQuery(null, undefined)).toBeNull();
    expect(OFFERED_CURRENCIES).toContain("TRY");
  });

  it("is taken only as an exact positive figure for the pair asked, with the day it was published", () => {
    const answer = { amount: 1, base: "EUR", date: "2026-10-12", rates: { TRY: 48.317 } };
    expect(readOffer(answer, "EUR", "TRY")).toEqual({ from: "EUR", to: "TRY", rate: "48.317", date: "2026-10-12" });
    expect(readOffer({ ...answer, rates: { TRY: 0.0292 } }, "EUR", "TRY")?.rate).toBe("0.0292");
    expect(readOffer(answer, "USD", "TRY")).toBeNull();
    expect(readOffer(answer, "EUR", "GBP")).toBeNull();
    expect(readOffer({ ...answer, rates: { TRY: 0 } }, "EUR", "TRY")).toBeNull();
    expect(readOffer({ ...answer, rates: { TRY: -3 } }, "EUR", "TRY")).toBeNull();
    expect(readOffer({ ...answer, rates: { TRY: Number.NaN } }, "EUR", "TRY")).toBeNull();
    expect(readOffer({ ...answer, date: "yesterday" }, "EUR", "TRY")).toBeNull();
    expect(readOffer("<html>", "EUR", "TRY")).toBeNull();
    expect(readOffer(null, "EUR", "TRY")).toBeNull();
  });
});

describe("what is news to a person", () => {
  const groups = async (): Promise<Group[]> => {
    const data: Record<string, string> = {};
    const shelf: Shelf = {
      getItem: (key) => data[key] ?? null,
      setItem: (key, value) => void (data[key] = value),
      removeItem: (key) => void delete data[key],
    };
    const store = createDemoStore(shelf, "en");
    return [(await store.getGroup("demo-istanbul"))!, (await store.getGroup("demo-flat"))!];
  };

  it("lists every expense and payment once, newest first", async () => {
    const all = await groups();
    const events = eventsOf(all);
    expect(events).toHaveLength(all.reduce((sum, group) => sum + group.expenses.length + group.settlements.length, 0));
    expect(events.map((event) => event.at)).toEqual([...events.map((event) => event.at)].sort().reverse());
    expect(
      events.find((event) => event.what === "Hotel deposit (entered twice)")?.kind ??
        events.find((event) => event.kind === "cancelled")?.kind,
    ).toBe("cancelled");
  });

  it("counts what others did since it was last read, never the person's own doings, and a payment waiting for them always", async () => {
    const events = eventsOf(await groups());
    const waiting = events.filter((event) => event.needsMe);
    // Deniz says they paid Alex: Alex, who is looking, is the one to confirm it.
    expect(waiting).toHaveLength(1);
    expect(waiting[0]).toMatchObject({ kind: "proposed", who: "Deniz", what: "Alex", mine: false });

    // Never opened before: nothing but the waiting payment is news.
    expect(countNew(events, null)).toBe(1);
    // Read long ago: everything others did since, and the waiting payment once.
    const others = events.filter((event) => !event.mine).length;
    expect(countNew(events, "2000-01-01T00:00:00.000Z")).toBe(others);
    // Read just now: only what still waits.
    expect(countNew(events, "2999-01-01T00:00:00.000Z")).toBe(1);
    const own = events.find((event) => event.mine)!;
    expect(isNew(own, "2000-01-01T00:00:00.000Z")).toBe(false);
  });
});

describe("favourite groups", () => {
  it("come first, each side in the order it had", () => {
    const list = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    expect(favouritesFirst(list, new Set(["c", "a"])).map((group) => group.id)).toEqual(["a", "c", "b", "d"]);
    expect(favouritesFirst(list, new Set())).toEqual(list);
    expect(favouritesFirst(list, new Set(["gone"]))).toEqual(list);
  });

  it("are read from what the device kept, and anything else there is taken as none", () => {
    expect(parseFavourites('["a","b"]')).toEqual(["a", "b"]);
    expect(parseFavourites("")).toEqual([]);
    expect(parseFavourites("not json")).toEqual([]);
    expect(parseFavourites('{"a":1}')).toEqual([]);
    expect(parseFavourites('["a",5,null,"b"]')).toEqual(["a", "b"]);
  });
});

describe("handing a file made on the server to whatever can save it", () => {
  const file = { url: "/api/v1/downloads/abc.def", name: "splitly-Квартира.pdf" };
  const withWindow = (telegram: unknown, work: (went: string[]) => void) => {
    const went: string[] = [];
    vi.stubGlobal("window", {
      location: { origin: "https://splitly.test", assign: (url: string) => went.push(`page ${url}`) },
      Telegram: telegram ? { WebApp: telegram } : undefined,
    });
    try {
      work(went);
    } finally {
      vi.unstubAllGlobals();
    }
  };

  it("uses Telegram's own downloader where the client has one, with the whole address and the file's real name", () => {
    const asked: unknown[] = [];
    withWindow(
      { downloadFile: (params: unknown) => asked.push(params), openLink: () => asked.push("link"), isVersionAtLeast: () => true },
      () => {
        expect(handOver(file)).toBe("telegram");
      },
    );
    expect(asked).toEqual([{ url: "https://splitly.test/api/v1/downloads/abc.def", file_name: "splitly-Квартира.pdf" }]);
  });

  it("opens the address in the phone's browser on a Telegram client too old to download, and simply follows it outside Telegram", () => {
    const opened: string[] = [];
    // The method is there but the client says it is older than the version that has it.
    withWindow(
      { downloadFile: () => opened.push("download"), openLink: (url: string) => opened.push(url), isVersionAtLeast: () => false },
      () => {
        expect(handOver(file)).toBe("browser");
      },
    );
    withWindow({ openLink: (url: string) => opened.push(url) }, () => expect(handOver(file)).toBe("browser"));
    expect(opened).toEqual(["https://splitly.test/api/v1/downloads/abc.def", "https://splitly.test/api/v1/downloads/abc.def"]);
    withWindow(null, (went) => {
      expect(handOver(file)).toBe("browser");
      expect(went).toEqual(["page https://splitly.test/api/v1/downloads/abc.def"]);
    });
  });
});
