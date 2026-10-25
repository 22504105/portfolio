"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import Link from "next/link";
import { useState, useTransition } from "react";
import { characters } from "@/lib/content/characters";
import { itemById, items, RARITY_LABEL, type Item, type Rarity, type Slot } from "@/lib/content/items";
import { tr } from "@/lib/content/text";
import { useNow, useStudent } from "@/lib/client/student";
import { balance, DEAL_DISCOUNT, dealOfTheDay, levelOf, owns, priceOf } from "@/lib/game/stats";
import { dayOf } from "@/lib/game/time";
import { fill, plural } from "@/lib/i18n";
import { BottomNav } from "./bottom-nav";
import { HeroFigure } from "./hero-figure";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/14_arcane_shop_2/code.html.
// Purchases are real and checked by the server: enough coins, not owned yet, the item's level
// reached; the coins come only from learning. Tapping an item puts it on the try-on list of the
// fitting room; the figure itself is the hero's base model until layered art exists (Gate 4).
// The deal of the day is one item at 25% off, in rotation. Item descriptions describe the item:
// the export's "+15% опыта" would be a learning advantage, which the brief forbids.
// Owner's decision 2026-10-24: Home's bottom bar (the export's "Лавка" tab goes; the shop opens
// from every coin balance). Tailwind v3 → v4: shadow-sm → shadow-xs, rounded → rounded-sm, backdrop-blur-sm → backdrop-blur-xs.

const TABS: { id: string; label: { ru: string; en: string }; slots: Slot[] | null }[] = [
  { id: "popular", label: { ru: "✦ Популярное", en: "✦ Popular" }, slots: null },
  { id: "hats", label: { ru: "Шляпы", en: "Hats" }, slots: ["headwear"] },
  { id: "cloaks", label: { ru: "Мантии", en: "Cloaks" }, slots: ["outerwear", "outfit"] },
  { id: "grimoires", label: { ru: "Гримуары", en: "Grimoires" }, slots: ["handheld"] },
  { id: "amulets", label: { ru: "Амулеты", en: "Amulets" }, slots: ["neck", "face", "back"] },
  { id: "companions", label: { ru: "Спутники", en: "Companions" }, slots: ["companion"] },
];

const RARITY_TAG: Record<Rarity, string> = {
  common: "bg-[#5B754E]/20 text-[#94B882] border-[#5B754E]/40",
  rare: "bg-[#8D75C9]/20 text-[#8D75C9] border-[#8D75C9]/40",
  epic: "bg-[#B99A61]/20 text-[#DFC082] border-[#B99A61]/40",
};
const RARITY_GLOW: Record<Rarity, string> = {
  common: "from-[#607D3B]/20",
  rare: "from-[#8D75C9]/20",
  epic: "from-[#B99A61]/15",
};
const ITEM_FORMS = {
  ru: { one: "{n} предмет", few: "{n} предмета", many: "{n} предметов", other: "{n} предмета" },
  en: { one: "{n} item", few: "{n} items", many: "{n} items", other: "{n} items" },
};

export function ShopScreen({ focus }: { focus?: string }) {
  const { t, locale, base, facts, act } = useStudent();
  const today = dayOf(useNow());
  const coins = balance(facts, "coins");
  const { level } = levelOf(balance(facts, "xp"));
  const hero = facts.profile.characterId ? characters[facts.profile.characterId] : characters.cat;
  const deal = dealOfTheDay(today);
  const [tab, setTab] = useState(TABS[0].id);
  const [tryOn, setTryOn] = useState<string[]>(() => (focus && itemById.has(focus) ? [focus] : []));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const slots = TABS.find((x) => x.id === tab)?.slots ?? null;
  const forSale = items.filter((item) => item.price > 0 && (slots === null || slots.includes(item.slot)));
  const order: Record<Rarity, number> = { epic: 0, rare: 1, common: 2 };
  const catalogue = [...forSale].sort((a, b) => (slots === null ? order[a.rarity] - order[b.rarity] : 0));

  function tryItem(item: Item) {
    setTryOn((current) => {
      const others = current.filter((id) => itemById.get(id)?.slot !== item.slot);
      return current.includes(item.id) ? others : [...others, item.id];
    });
  }

  function buy(item: Item) {
    setMessage(null);
    startTransition(async () => {
      const result = await act({ type: "buy", itemId: item.id });
      if (result.ok) setMessage({ ok: true, text: fill(t.shop.bought, { item: tr(item.name, locale) }) });
      else
        setMessage({
          ok: false,
          text:
            result.refusal === "not_enough_coins"
              ? t.shop.notEnough
              : result.refusal === "level_too_low"
                ? fill(t.shop.needLevel, { n: item.level })
                : t.common.actionFailed,
        });
    });
  }

  function priceTag(item: Item) {
    if (owns(facts, item.id))
      return (
        <span className="rounded-sm border border-[#6E5A3A]/30 bg-[#14141E] px-2 py-0.5 font-sans text-[11px] font-medium text-[#9B968D]">
          {t.shop.owned}
        </span>
      );
    if (level < item.level)
      return (
        <span className="rounded-sm border border-[#93000a]/40 bg-[#93000a]/30 px-2 py-0.5 font-sans text-[10px] font-medium text-[#ffb4ab]">
          {fill(t.shop.levelTag, { n: item.level })}
        </span>
      );
    return (
      <button
        type="button"
        data-buy={item.id}
        disabled={pending}
        onClick={(event) => {
          event.stopPropagation();
          buy(item);
        }}
        className="rounded-sm border border-[#B99A61] bg-[#1C1B27] px-2.5 py-0.5 font-sans text-xs font-medium text-[#DFC082] transition-all hover:bg-[#B99A61] hover:text-[#101016] active:scale-95 disabled:opacity-60"
      >
        {t.shop.buy}
      </button>
    );
  }

  return (
    <div
      data-scope="shop"
      className="font-garamond flex min-h-dvh items-start justify-center bg-[#101016] text-[#E8E1D5] antialiased select-none"
    >
      <div className="relative flex h-dvh w-full max-w-[390px] flex-col overflow-hidden border border-[#2b271d] bg-[#101016] shadow-2xl">
        <header className="z-20 shrink-0 border-b border-[#2d281f]/60 bg-gradient-to-b from-[#14141d] to-[#101016] px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <Link
              href={`${base}/profile`}
              aria-label={t.common.back}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#6E5A3A]/40 bg-[#1C1B27] text-[#B99A61] transition-transform active:scale-95"
            >
              <svg className="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </Link>
            <div className="text-center">
              <span className="block font-sans text-[10px] font-medium tracking-[0.2em] text-[#8D75C9] uppercase">{t.shop.academy}</span>
              <h1 className="font-cinzel text-xl leading-tight font-bold tracking-wide text-[#E8E1D5]">{t.shop.title}</h1>
            </div>
            <div className="gold-glow flex items-center gap-1.5 rounded-full border border-[#B99A61]/60 bg-[#1C1B27] px-3 py-1">
              <span className="text-sm">🪙</span>
              <span className="font-sans text-sm font-bold tracking-tight text-[#DFC082]" data-coins>
                {fill(t.rewards.coins, { n: coins })}
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-center gap-1 text-center font-sans text-[10.5px] leading-3 text-[#9B968D]">
            <span className="text-[#B99A61]/80">✦</span>
            <span>{t.shop.disclaimer}</span>
            <span className="text-[#B99A61]/80">✦</span>
          </div>
        </header>

        <main className="no-scrollbar flex-1 space-y-3.5 overflow-y-auto px-4 pt-2.5 pb-24">
          <section className="relative overflow-hidden rounded-2xl border border-[#B99A61]/45 bg-[#1C1B27] p-3 shadow-xl">
            <div className="pointer-events-none absolute -top-10 -right-10 h-48 w-48 rounded-full bg-[#8D75C9]/15 blur-2xl"></div>
            <div className="pointer-events-none absolute -bottom-8 -left-8 h-44 w-44 rounded-full bg-[#B99A61]/10 blur-xl"></div>
            <div className="relative z-10 mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#DFC082]">✨</span>
                <span className="font-cinzel text-xs font-bold tracking-wider text-[#DFC082] uppercase">{t.shop.fitting}</span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#8D75C9]/35 bg-[#8D75C9]/15 px-2 py-0.5 font-sans text-[10px] font-semibold text-[#B3A3E6]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8D75C9] motion-safe:animate-pulse"></span>
                {t.shop.live}
              </span>
            </div>
            <div className="relative flex h-52 w-full flex-col items-center justify-end overflow-hidden rounded-xl border border-[#6E5A3A]/30 bg-gradient-to-b from-[#14141E] via-[#101017] to-[#171622]">
              <div className="rotate-slow absolute bottom-1 h-12 w-48 rounded-full border border-[#8D75C9]/40 bg-[#8D75C9]/10 blur-[0.5px]"></div>
              <div className="absolute bottom-2 h-9 w-36 rounded-full border border-[#DFC082]/50 bg-[#DFC082]/10 shadow-[0_0_18px_rgba(223,192,130,0.3)]"></div>
              <div className="relative z-10 flex h-44 w-44 items-center justify-center">
                {/* Gate 4: the try-on is drawn on the figure where the item has fitted layers. */}
                <HeroFigure
                  species={hero.id}
                  equipped={{ ...facts.equipped, ...Object.fromEntries(tryOn.map((id) => [itemById.get(id)!.slot, id])) }}
                  alt={tr(hero.species, locale)}
                  className="h-full w-auto drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)]"
                  plainClassName="h-full w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)] filter"
                />
              </div>
              <div className="absolute top-2 left-2 z-10 flex flex-col gap-1" aria-label={t.shop.tryingOn}>
                {(tryOn.length ? tryOn : Object.values(facts.equipped).filter((id): id is string => !!id)).slice(0, 4).map((id, i) => {
                  const item = itemById.get(id);
                  if (!item) return null;
                  return (
                    <span
                      key={id}
                      className={`flex items-center gap-1 rounded-md border bg-[#101016]/85 px-2 py-0.5 font-sans text-[10px] backdrop-blur-xs ${
                        i % 2 ? "border-[#8D75C9]/50 text-[#D8B4FE]" : "border-[#6E5A3A]/50 text-[#E8E1D5]"
                      }`}
                    >
                      <span className="text-[#DFC082]">✦</span> {tr(item.name, locale)}
                    </span>
                  );
                })}
              </div>
              <div className="absolute right-2 bottom-2 z-10">
                <button
                  type="button"
                  onClick={() => setTryOn([])}
                  className="flex items-center gap-1 rounded-full border border-[#6E5A3A]/40 bg-[#101016]/80 px-2.5 py-1 font-sans text-[10px] text-[#9B968D] transition-colors hover:bg-[#101016] hover:text-[#DFC082]"
                >
                  <svg className="h-3 w-3 fill-none stroke-current" viewBox="0 0 24 24">
                    <path
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    ></path>
                  </svg>
                  {t.shop.resetLook}
                </button>
              </div>
            </div>
          </section>

          <nav
            aria-label={t.shop.categories}
            className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-0.5"
            role="tablist"
          >
            {TABS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={tab === option.id}
                onClick={() => setTab(option.id)}
                className={
                  tab === option.id
                    ? "rounded-full bg-gradient-to-r from-[#B99A61] to-[#DFC082] px-3.5 py-1.5 font-sans text-xs font-semibold tracking-wide whitespace-nowrap text-[#101016] shadow-xs active:opacity-90"
                    : "rounded-full border border-[#6E5A3A]/40 bg-[#1C1B27] px-3.5 py-1.5 font-sans text-xs whitespace-nowrap text-[#E8E1D5]/80 active:bg-[#252433]"
                }
              >
                {option.label[locale]}
              </button>
            ))}
          </nav>

          {message ? (
            <p
              role={message.ok ? "status" : "alert"}
              className={`text-center font-sans text-xs ${message.ok ? "text-status-success" : "text-status-error"}`}
            >
              {message.text}
            </p>
          ) : null}

          <section
            className="relative overflow-hidden rounded-2xl border border-[#B99A61]/50 bg-[#1C1B27] p-3 shadow-lg"
            data-deal={deal.id}
          >
            <div className="pointer-events-none absolute -top-10 -right-10 h-44 w-44 rounded-full bg-[#8D75C9]/15 blur-2xl"></div>
            <div className="mb-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-sm border border-[#B99A61]/30 bg-[#B99A61]/15 px-2 py-0.5 font-sans text-[10px] font-bold tracking-wider text-[#DFC082] uppercase">
                <span>⚡</span> {fill(t.shop.deal, { n: Math.round(DEAL_DISCOUNT * 100) })}
              </span>
              <span className="font-sans text-[11px] font-medium text-[#8D75C9]">{tr(RARITY_LABEL[deal.rarity], locale)}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => tryItem(deal)}
                className="arcane-glow relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[#8D75C9]/50 bg-[#14141E]"
              >
                <img
                  alt={tr(deal.name, locale)}
                  className="h-full w-full transform object-cover object-center transition-transform duration-300 hover:scale-105"
                  src={deal.image}
                />
                <span className="absolute right-1 bottom-1 rounded-sm bg-black/60 px-1 font-sans text-[9px] text-[#DFC082] backdrop-blur-xs">
                  {t.shop.artifact}
                </span>
              </button>
              <div className="flex h-24 flex-1 flex-col justify-between py-0.5">
                <div>
                  <h2 className="font-cinzel text-sm leading-tight font-bold text-[#E8E1D5]">{tr(deal.name, locale)}</h2>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#9B968D]">{tr(deal.note, locale)}</p>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-sans text-xs font-bold text-[#DFC082]">🪙 {priceOf(deal, today)}</span>
                    <span className="font-sans text-[10px] text-[#9B968D] line-through">{deal.price}</span>
                  </div>
                  {owns(facts, deal.id) ? (
                    priceTag(deal)
                  ) : (
                    <button
                      type="button"
                      data-buy={deal.id}
                      disabled={pending || level < deal.level}
                      onClick={() => buy(deal)}
                      className="gold-gradient-bg rounded-lg px-3 py-1 font-sans text-xs font-bold tracking-wide text-[#101016] shadow-md transition-all hover:brightness-110 active:scale-95 disabled:opacity-60"
                    >
                      {level < deal.level ? fill(t.shop.levelTag, { n: deal.level }) : t.shop.buy}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-between pt-0.5">
            <h3 className="font-cinzel flex items-center gap-1.5 text-sm font-semibold tracking-wide text-[#E8E1D5]">
              <span className="text-[#B99A61]">✦</span> {t.shop.catalogue}
            </h3>
            <span className="font-sans text-[11px] text-[#9B968D]">{plural(locale, catalogue.length, ITEM_FORMS[locale])}</span>
          </div>

          <section className="grid grid-cols-2 gap-2.5">
            {catalogue.map((item) => {
              const trying = tryOn.includes(item.id);
              return (
                <article
                  key={item.id}
                  data-item={item.id}
                  onClick={() => tryItem(item)}
                  className={`frame-corner relative flex cursor-pointer flex-col justify-between rounded-xl border bg-[#1C1B27] p-2.5 ${trying ? "border-[#DFC082]" : "border-[#6E5A3A]/40"}`}
                >
                  <div>
                    <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-[#6E5A3A]/25 bg-[#14141E] p-2">
                      <div
                        className={`absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] via-transparent to-transparent ${RARITY_GLOW[item.rarity]}`}
                      ></div>
                      <img
                        alt={tr(item.name, locale)}
                        src={item.image}
                        className="relative z-10 h-full w-auto object-contain drop-shadow-[0_4px_8px_rgba(141,117,201,0.5)]"
                      />
                      <span
                        className={`absolute top-1.5 left-1.5 z-20 rounded-sm border px-1.5 py-[1px] font-sans text-[9px] font-medium ${RARITY_TAG[item.rarity]}`}
                      >
                        {tr(RARITY_LABEL[item.rarity], locale)}
                      </span>
                    </div>
                    <h4 className="font-cinzel mt-2 text-sm leading-snug font-bold text-[#E8E1D5]">{tr(item.name, locale)}</h4>
                    <p className="line-clamp-1 text-[10px] text-[#9B968D]">{tr(item.note, locale)}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-[#6E5A3A]/20 pt-1.5">
                    <span className="font-sans text-xs font-semibold text-[#DFC082]">🪙 {priceOf(item, today)}</span>
                    {priceTag(item)}
                  </div>
                </article>
              );
            })}
          </section>

          <div className="rounded-xl border border-[#6E5A3A]/30 bg-[#14141E] p-2.5 text-center">
            <p className="text-[11px] text-[#9B968D]">
              {t.shop.note}{" "}
              <Link href={`${base}/wardrobe`} className="text-[#DFC082] underline underline-offset-2">
                {t.shop.toWardrobe}
              </Link>
            </p>
          </div>
        </main>
        <BottomNav base={base} active="profile" labels={t.nav} />
      </div>
    </div>
  );
}
