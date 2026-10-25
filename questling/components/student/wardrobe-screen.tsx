"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import Link from "next/link";
import { useState, useTransition } from "react";
import { characters } from "@/lib/content/characters";
import { figureOf } from "@/lib/content/figure";
import { itemById, items, RARITY_LABEL, SLOT_GROUPS, SLOT_LABEL, SLOTS, type Item, type Slot } from "@/lib/content/items";
import { tr } from "@/lib/content/text";
import { useStudent } from "@/lib/client/student";
import { balance, levelOf, owns, priceOf, rankOf } from "@/lib/game/stats";
import { dayOf } from "@/lib/game/time";
import { fill } from "@/lib/i18n";
import { HeroFigure } from "./hero-figure";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/13_wardrobe_2/code.html.
// Equipping is real: the look is edited here and stored with "Сохранить образ" (server-checked:
// only owned items, in their own slot, from the right level, for this hero, without a slot conflict).
// Gate 4: the figure is drawn in layers (HeroFigure) where fitted art exists — the cat's witch hat,
// ceremonial cape and star amulet; any other worn item is named under the figure as not drawn yet
// (NEEDS_ART_ASSET), and still shows on the slot markers and the chips. The
// export's "3D ВИД" badge is left out: there is no 3D model (the brief forbids claiming one).
// Item emoji are replaced by each item's own picture.
// Tailwind v3 → v4: shadow-sm → shadow-xs, shadow → shadow-sm, rounded → rounded-sm, backdrop-blur-sm → backdrop-blur-xs.

type Look = Partial<Record<Slot, string | null>>;

const MARKERS: { slot: Slot; place: string; violet: boolean; labelFirst: boolean }[] = [
  { slot: "headwear", place: "top-10 right-7", violet: false, labelFirst: false },
  { slot: "outerwear", place: "top-28 left-4", violet: true, labelFirst: true },
  { slot: "handheld", place: "bottom-16 right-4", violet: true, labelFirst: false },
  { slot: "companion", place: "bottom-14 left-4", violet: true, labelFirst: true },
];

export function WardrobeScreen() {
  const { t, locale, base, facts, act } = useStudent();
  const [look, setLook] = useState<Look>(() => ({ ...facts.equipped }));
  const [group, setGroup] = useState(SLOT_GROUPS[0].id);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const { level } = levelOf(balance(facts, "xp"));
  const hero = facts.profile.characterId ? characters[facts.profile.characterId] : characters.cat;
  const today = dayOf(new Date());
  // The chips name what is worn over the base clothes, as the export does.
  const worn = SLOTS.filter((slot) => slot !== "outfit")
    .map((slot) => (look[slot] ? itemById.get(look[slot]!) : undefined))
    .filter((item): item is Item => !!item);
  // Worn items the figure cannot draw (no fitted art: docs/ASSET_AUDIT.md, NEEDS_ART_ASSET), outfits
  // included: the academy tunic is violet, the hero's drawn base clothes are not.
  const notDrawn = figureOf(hero.id, look).pending.map((id) => itemById.get(id)!);
  const changed = SLOTS.some((slot) => (look[slot] ?? null) !== (facts.equipped[slot] ?? null));
  const slots = SLOT_GROUPS.find((g) => g.id === group)?.slots ?? [];
  const shown = items.filter((item) => slots.includes(item.slot)).sort((a, b) => Number(owns(facts, b.id)) - Number(owns(facts, a.id)));

  function toggle(item: Item) {
    setMessage(null);
    setLook((current) => {
      if (current[item.slot] === item.id) return { ...current, [item.slot]: null };
      const next: Look = { ...current, [item.slot]: item.id };
      // Putting it on takes off what it cannot be worn with, either way round.
      for (const slot of item.conflicts) next[slot] = null;
      for (const slot of SLOTS) {
        const other = next[slot] ? itemById.get(next[slot]!) : undefined;
        if (other && other.id !== item.id && other.conflicts.includes(item.slot)) next[slot] = null;
      }
      return next;
    });
  }

  function save() {
    const wanted: Look = {};
    for (const slot of SLOTS) if ((look[slot] ?? null) !== (facts.equipped[slot] ?? null)) wanted[slot] = look[slot] ?? null;
    startTransition(async () => {
      const result = await act({ type: "saveLook", equipped: wanted });
      setMessage(result.ok ? { ok: true, text: t.wardrobe.saved } : { ok: false, text: t.common.actionFailed });
    });
  }

  return (
    <div className="font-garamond flex min-h-dvh items-center justify-center bg-[#0B0A0F] p-0 text-[#E8E1D5] antialiased">
      <main className="bg-arcana-bg border-arcana-border/40 relative flex h-dvh w-full max-w-[390px] flex-col justify-between overflow-hidden border shadow-2xl">
        <div
          aria-hidden="true"
          className="bg-arcana-violet/20 pointer-events-none absolute top-16 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full blur-[100px]"
        ></div>
        <div
          aria-hidden="true"
          className="bg-arcana-gold/15 pointer-events-none absolute bottom-10 left-10 h-48 w-48 rounded-full blur-[90px]"
        ></div>
        <div className="hide-scrollbar flex flex-1 flex-col overflow-y-auto">
          <header className="bg-arcana-bg/90 border-arcana-border/30 sticky top-0 z-30 flex items-center justify-between border-b px-4 pt-3 pb-2.5 backdrop-blur-md">
            <Link
              href={`${base}/profile`}
              aria-label={t.common.back}
              className="bg-arcana-surface/80 border-arcana-border/60 text-arcana-gold hover:bg-arcana-surfaceBright flex h-11 w-11 items-center justify-center rounded-xl border transition-all focus:outline-none active:scale-95"
            >
              <svg className="h-5 w-5 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </Link>
            <div className="text-center">
              <div className="text-arcana-gold flex items-center justify-center gap-1.5">
                <span className="text-xs">✦</span>
                <h1 className="font-cinzel text-arcana-ivory text-lg font-bold tracking-widest uppercase">{t.wardrobe.title}</h1>
                <span className="text-xs">✦</span>
              </div>
              <span className="text-arcana-ivoryMuted font-garamond text-[11px] tracking-wider uppercase">{t.wardrobe.subtitle}</span>
            </div>
            <Link
              href={`${base}/shop`}
              aria-label={t.shop.title}
              className="bg-arcana-surface/90 border-arcana-border flex h-11 items-center gap-1.5 rounded-xl border px-3 shadow-xs"
            >
              <span className="text-base select-none">🪙</span>
              <span className="font-cinzel text-arcana-gold text-sm font-semibold tracking-wide">{balance(facts, "coins")}</span>
            </Link>
          </header>

          <section aria-label={t.wardrobe.studio} className="relative flex flex-col items-center px-3 pt-2">
            <div className="hero-podium-gradient border-arcana-border/30 relative flex h-[335px] w-full items-center justify-center overflow-hidden rounded-2xl border shadow-inner">
              <div className="runic-circle absolute h-72 w-72 rounded-full opacity-50"></div>
              <div className="orbit-ring absolute h-56 w-56 rounded-full motion-safe:animate-pulse"></div>
              <div className="bg-arcana-surface/90 border-arcana-gold/50 absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 rounded-full border px-2.5 py-1 shadow-md backdrop-blur-xs">
                <span className="bg-arcana-violet h-2 w-2 rounded-full shadow-[0_0_6px_#8D75C9]"></span>
                <span className="font-cinzel text-arcana-gold text-xs font-semibold">{fill(t.wardrobe.level, { n: level })}</span>
                <span className="text-arcana-ivoryMuted font-garamond text-[11px]">• {tr(rankOf(level), locale)}</span>
              </div>
              <div className="absolute bottom-2 h-12 w-64 rounded-[100%] bg-gradient-to-r from-transparent via-[#8D75C9]/45 to-transparent blur-md"></div>
              <div className="border-arcana-gold/60 absolute bottom-4 h-6 w-52 rounded-[100%] border bg-[#1C1B27]/90 shadow-[0_0_15px_rgba(185,154,97,0.3)]"></div>
              <div className="border-arcana-violet/60 absolute bottom-5 h-3 w-40 rounded-[100%] border"></div>

              {MARKERS.map(({ slot, place, violet, labelFirst }) => {
                const item = look[slot] ? itemById.get(look[slot]!) : undefined;
                const label = (
                  <span
                    className={`bg-arcana-bg/80 border-arcana-border font-cinzel rounded-sm border px-1.5 py-0.5 text-[9px] backdrop-blur-xs ${item ? "text-arcana-gold" : "text-arcana-ivoryMuted"}`}
                  >
                    {tr(SLOT_LABEL[slot], locale)}
                  </span>
                );
                return (
                  <button
                    key={slot}
                    type="button"
                    aria-label={fill(t.wardrobe.slot, { slot: tr(SLOT_LABEL[slot], locale) })}
                    onClick={() => setGroup(SLOT_GROUPS.find((g) => g.slots.includes(slot))!.id)}
                    className={`group absolute z-20 flex items-center gap-1.5 focus:outline-none ${place}`}
                  >
                    {labelFirst ? label : null}
                    {item ? (
                      <div
                        className={`bg-arcana-surface/95 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 transition-all group-hover:scale-110 group-active:scale-95 ${
                          violet ? "border-arcana-violet shadow-glow-violet" : "border-arcana-gold shadow-orbit-slot"
                        }`}
                      >
                        <img alt="" src={item.image} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="bg-arcana-surface/80 border-arcana-border text-arcana-ivoryMuted flex h-8 w-8 items-center justify-center rounded-full border border-dashed text-xs transition-all group-hover:scale-110 group-active:scale-95">
                        <span className="text-arcana-gold text-[10px]">+</span>
                      </div>
                    )}
                    {labelFirst ? null : label}
                  </button>
                );
              })}

              <HeroFigure
                species={hero.id}
                equipped={look}
                alt={tr(hero.species, locale)}
                className="z-10 h-[330px] w-auto drop-shadow-[0_16px_28px_rgba(0,0,0,0.9)]"
                plainClassName="relative z-10 h-[300px] w-auto max-w-[280px] object-contain contrast-105 drop-shadow-[0_16px_28px_rgba(0,0,0,0.9)] filter transition-transform duration-300 select-none"
              />
            </div>
            <div aria-label={t.wardrobe.worn} className="mt-2 flex w-full flex-wrap items-center justify-center gap-1.5">
              {worn.length === 0 ? <span className="text-arcana-ivoryMuted text-[11px]">{t.wardrobe.nothing}</span> : null}
              {worn.map((item) => (
                <span
                  key={item.id}
                  className="bg-arcana-surface/90 border-arcana-violet/50 text-arcana-ivory flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium shadow-xs"
                >
                  <span className="bg-arcana-gold h-1.5 w-1.5 rounded-full"></span>
                  {tr(item.name, locale)}
                </span>
              ))}
            </div>
            {notDrawn.length ? (
              <p className="text-arcana-ivoryMuted mt-1 text-center text-[11px]" data-not-drawn>
                {fill(t.wardrobe.notDrawn, { items: notDrawn.map((item) => tr(item.name, locale)).join(", ") })}
              </p>
            ) : null}
          </section>

          <section aria-label={t.wardrobe.categories} className="mt-2.5 px-3">
            <div className="hide-scrollbar flex items-center gap-1.5 overflow-x-auto py-0.5" role="tablist">
              {SLOT_GROUPS.map((option) =>
                option.id === group ? (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected="true"
                    className="text-arcana-ivory from-arcana-violet/30 via-arcana-surfaceBright to-arcana-violet/30 border-arcana-gold/80 shadow-slot-active flex h-8 flex-shrink-0 items-center gap-1 rounded-full border bg-gradient-to-r px-3.5 text-xs font-semibold"
                  >
                    <span className="text-arcana-gold text-xs">✦</span>
                    {tr(option.label, locale)}
                  </button>
                ) : (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected="false"
                    onClick={() => setGroup(option.id)}
                    className="font-garamond text-arcana-ivoryMuted bg-arcana-surface/70 hover:text-arcana-ivory border-arcana-border/40 h-8 flex-shrink-0 rounded-full border px-3 text-xs transition-all"
                  >
                    {tr(option.label, locale)}
                  </button>
                ),
              )}
            </div>
          </section>

          <section aria-label={t.wardrobe.items} className="mt-2 flex-1 px-3.5 pb-3">
            <div className="grid grid-cols-2 gap-2">
              {shown.map((item) => {
                const owned = owns(facts, item.id);
                const on = look[item.slot] === item.id;
                const tooLow = level < item.level;
                if (on)
                  return (
                    <article
                      key={item.id}
                      data-item={item.id}
                      className="bg-arcana-surface border-arcana-gold shadow-glow-violet relative flex flex-col justify-between rounded-xl border-2 p-2.5"
                    >
                      <div className="bg-arcana-gold text-arcana-bg absolute top-2 right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full shadow-sm">
                        <svg className="h-3.5 w-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <ItemPicture item={item} />
                      <div className="mt-1 text-center">
                        <h2 className="text-arcana-ivory truncate text-xs font-semibold">{tr(item.name, locale)}</h2>
                        <p className="text-arcana-gold font-cinzel text-[9px] tracking-wider uppercase">
                          {tr(RARITY_LABEL[item.rarity], locale)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggle(item)}
                        className="bg-arcana-gold/15 hover:bg-arcana-gold/25 border-arcana-gold/50 mt-1.5 w-full rounded-lg border py-1 text-center transition-all active:scale-95"
                      >
                        <span className="text-arcana-gold text-[10px] font-semibold">{t.wardrobe.wornTakeOff}</span>
                      </button>
                    </article>
                  );
                if (owned)
                  return (
                    <article
                      key={item.id}
                      data-item={item.id}
                      className="bg-arcana-surface/85 border-arcana-border/50 hover:border-arcana-gold/50 relative flex flex-col justify-between rounded-xl border p-2.5 transition-colors"
                    >
                      <div className="absolute top-2 left-2 z-10">
                        <span className="bg-arcana-surfaceBright border-arcana-borderMuted text-arcana-ivoryMuted rounded-sm border px-1 py-[1px] text-[8px]">
                          {t.wardrobe.inChest}
                        </span>
                      </div>
                      <ItemPicture item={item} />
                      <div className="mt-1 text-center">
                        <h2 className="text-arcana-ivory truncate text-xs font-semibold">{tr(item.name, locale)}</h2>
                        <p className="text-arcana-ivoryMuted font-cinzel text-[9px] tracking-wider">{tr(item.note, locale)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={tooLow}
                        onClick={() => toggle(item)}
                        className="bg-arcana-surfaceBright hover:bg-arcana-violet/25 border-arcana-border mt-1.5 w-full rounded-lg border py-1 text-center transition-all active:scale-95 disabled:opacity-50"
                      >
                        <span className="text-arcana-ivory text-[10px] font-medium">
                          {tooLow ? fill(t.wardrobe.fromLevel, { n: item.level }) : t.wardrobe.putOn}
                        </span>
                      </button>
                    </article>
                  );
                return (
                  <article
                    key={item.id}
                    data-item={item.id}
                    className="bg-arcana-surface/50 border-arcana-borderMuted relative flex flex-col justify-between rounded-xl border p-2.5 opacity-90"
                  >
                    <div className="bg-arcana-surfaceBright/80 border-arcana-borderMuted text-arcana-ivoryMuted absolute top-2 right-2 z-10 flex h-4 w-4 items-center justify-center rounded-full border">
                      <svg className="h-2.5 w-2.5 stroke-current" fill="none" strokeWidth="2" viewBox="0 0 24 24">
                        <rect height="11" rx="2" ry="2" width="18" x="3" y="11"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </div>
                    <ItemPicture item={item} dim />
                    <div className="mt-1 text-center">
                      <h2 className="text-arcana-ivory truncate text-xs font-semibold">{tr(item.name, locale)}</h2>
                      <p className="text-arcana-gold font-cinzel text-[9px] tracking-wider">
                        {item.price > 0 ? t.wardrobe.inShop : t.wardrobe.earned}
                      </p>
                    </div>
                    {item.price > 0 ? (
                      <Link
                        href={`${base}/shop?item=${item.id}`}
                        className="bg-arcana-gold/10 hover:bg-arcana-gold/20 border-arcana-gold/40 mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border py-1 text-center transition-all active:scale-95"
                      >
                        <span className="text-[9px]">🪙</span>
                        <span className="font-cinzel text-arcana-gold text-[10px] font-bold">{priceOf(item, today)}</span>
                        <span className="text-arcana-gold text-[9px]">{t.shop.buy}</span>
                      </Link>
                    ) : (
                      <div className="border-arcana-borderMuted text-arcana-ivoryMuted mt-1.5 w-full rounded-lg border py-1 text-center text-[10px]">
                        {t.wardrobe.locked}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="bg-arcana-surface/95 border-arcana-border/40 z-30 flex w-full flex-col gap-1.5 border-t p-3 backdrop-blur-md">
          {message ? (
            <p
              role={message.ok ? "status" : "alert"}
              className={`text-center text-[11px] ${message.ok ? "text-status-success" : "text-status-error"}`}
            >
              {message.text}
            </p>
          ) : null}
          <div className="grid grid-cols-5 gap-2">
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setLook(Object.fromEntries(SLOTS.map((slot) => [slot, null])));
              }}
              className="border-arcana-border text-arcana-ivoryMuted hover:text-arcana-ivory hover:bg-arcana-surfaceBright font-garamond col-span-2 flex h-11 items-center justify-center gap-1 rounded-xl border text-xs font-semibold transition-all active:scale-95"
            >
              <svg className="h-3.5 w-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <path
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                ></path>
              </svg>
              {t.wardrobe.takeOffAll}
            </button>
            <button
              type="button"
              data-action="save-look"
              onClick={save}
              disabled={!changed || pending}
              aria-busy={pending}
              className="from-arcana-gold via-arcana-goldLight to-arcana-gold text-arcana-bg font-cinzel col-span-3 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r text-xs font-bold tracking-wider uppercase shadow-md transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
            >
              <svg className="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              {t.wardrobe.save}
            </button>
          </div>
          <p className="text-arcana-ivoryMuted font-garamond px-2 text-center text-[10px] leading-tight">{t.wardrobe.note}</p>
        </footer>
      </main>
    </div>
  );
}

function ItemPicture({ item, dim = false }: { item: Item; dim?: boolean }) {
  const { locale } = useStudent();
  return (
    <div className="bg-arcana-surfaceLow border-arcana-borderMuted/40 flex h-14 w-full items-center justify-center overflow-hidden rounded-lg border">
      <img alt={tr(item.name, locale)} src={item.image} className={`h-full w-auto object-contain ${dim ? "opacity-85" : ""}`} />
    </div>
  );
}
