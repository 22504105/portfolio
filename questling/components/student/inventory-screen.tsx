"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { characters } from "@/lib/content/characters";
import { itemById, items, RARITY_LABEL, SLOT_LABEL, type Item, type Rarity, type Slot } from "@/lib/content/items";
import { tr } from "@/lib/content/text";
import { useStudent } from "@/lib/client/student";
import { balance, foundClues, levelOf, owns } from "@/lib/game/stats";
import { clueChapter } from "@/lib/student/story";
import { fill } from "@/lib/i18n";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/15_inventory/code.html.
// The bag holds the student's own items and the story artefacts (clues) they have found;
// "Осмотреть" opens a clue in the journal. "Снять" and "Надеть" change the saved look at once.
// Two lines of the export would promise game bonuses ("Бонус сета +5% Маны", "+10 Концентрация");
// cosmetics give none (the brief), so the badge counts filled slots and each card shows the
// item's description. "Вместимость" becomes the collection count: there is no bag limit.
// Owner's decision 2026-10-24: the header names the screen (the export's was copied from 06).
// Tailwind v3 → v4: shadow-sm → shadow-xs, rounded → rounded-sm, backdrop-blur-sm → backdrop-blur-xs.

type Filter = "all" | "gear" | "quest";

const RARITY_TAG: Record<Rarity, string> = {
  common: "bg-surface-variant text-text-muted",
  rare: "bg-secondary/20 text-secondary",
  epic: "bg-primary/20 text-primary",
};

const SHOWN_SLOTS: Slot[] = ["headwear", "outerwear", "handheld", "neck", "face", "back", "companion"];

export function InventoryScreen() {
  const { t, locale, base, facts, act } = useStudent();
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const coins = balance(facts, "coins");
  const { level } = levelOf(balance(facts, "xp"));
  const hero = facts.profile.characterId ? characters[facts.profile.characterId] : characters.cat;
  const heroName = facts.profile.heroName ?? tr(hero.name, locale);
  const order: Record<Rarity, number> = { epic: 0, rare: 1, common: 2 };
  const owned = items.filter((item) => owns(facts, item.id)).sort((a, b) => order[a.rarity] - order[b.rarity]);
  const locked = items.filter((item) => !owns(facts, item.id) && item.level > level).slice(0, 1);
  const clues = foundClues(facts).map(({ campaign, clue }) => ({ chapter: clueChapter(campaign, clue.id), clue }));
  const equippedSlots = SHOWN_SLOTS.filter((slot) => facts.equipped[slot]);
  const emptySlot = SHOWN_SLOTS.find((slot) => !facts.equipped[slot]);

  function equip(slot: Slot, itemId: string | null) {
    setError(false);
    startTransition(async () => {
      const result = await act({ type: "saveLook", equipped: { [slot]: itemId } });
      if (!result.ok) setError(true);
    });
  }

  const count = owned.length + clues.length;

  return (
    <div className="bg-background text-text-ivory flex min-h-dvh flex-col">
      <header className="bg-surface/90 pt-safe fixed inset-x-0 top-0 z-50 shadow-[0_1px_8px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="px-gutter mx-auto flex h-16 w-full max-w-md items-center justify-between">
          <div className="gap-space-xs flex items-center">
            <Link
              href={`${base}/profile`}
              aria-label={t.common.back}
              className="text-primary flex h-11 w-11 items-center justify-center transition-transform active:scale-95"
            >
              <Icon name="arrow_back" className="text-[24px]" />
            </Link>
            <h1 className="font-headline-md text-headline-md text-text-ivory line-clamp-1 tracking-tight">{t.inventory.title}</h1>
          </div>
          <div className="gap-space-sm flex items-center">
            <div className="gap-space-xs bg-surface-container-high px-space-sm flex items-center rounded-full py-1">
              <Icon name="magic_button" className="text-secondary text-[16px]" />
              <span className="font-label-sm text-label-sm text-secondary">{t.puzzle.quest}</span>
            </div>
            <Link
              href={`${base}/profile`}
              aria-label={t.common.profile}
              className="bg-primary flex h-8 w-8 items-center justify-center rounded-full shadow-[0_0_8px_rgba(228,194,133,0.3)]"
            >
              <Icon name="person" className="text-on-primary text-[18px]" />
            </Link>
          </div>
        </div>
      </header>

      <main className="pb-safe px-gutter bg-background relative mx-auto flex w-full max-w-md flex-1 flex-col pt-16">
        <div className="flex w-full flex-col space-y-4 pb-8">
          <div className="px-space-md py-space-xs bg-surface-container flex items-center justify-between rounded-xl shadow-md">
            <Link href={`${base}/shop`} className="gap-space-xs flex items-center" aria-label={t.shop.title}>
              <Icon name="monetization_on" filled className="text-primary text-[20px]" />
              <span className="font-headline-md text-title-sm text-text-ivory">{coins}</span>
              <span className="font-caption text-caption text-tertiary">{t.inventory.coins}</span>
            </Link>
            <div className="gap-space-xs bg-surface-container-high px-space-sm flex items-center rounded-full py-0.5">
              <Icon name="inventory_2" className="text-secondary text-[16px]" />
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {t.inventory.collection}{" "}
                <strong className="text-text-ivory">
                  {owned.length} / {items.length}
                </strong>
              </span>
            </div>
          </div>

          <section className="bg-surface p-space-md relative overflow-hidden rounded-xl shadow-xl">
            <div className="bg-secondary-container/20 pointer-events-none absolute -top-10 -right-10 h-44 w-44 rounded-full blur-3xl"></div>
            <div className="bg-primary-container/15 pointer-events-none absolute -bottom-10 -left-10 h-44 w-44 rounded-full blur-3xl"></div>
            <div className="mb-space-sm relative z-10 flex items-center justify-between">
              <div className="gap-space-xs flex items-center">
                <Icon name="ward" className="text-primary text-[18px]" />
                <h2 className="font-headline-md text-headline-md text-text-ivory">{t.inventory.equipped}</h2>
              </div>
              <span className="font-caption text-caption text-secondary bg-surface-container-high px-space-xs rounded-sm py-0.5">
                {fill(t.inventory.slots, { n: equippedSlots.length, total: SHOWN_SLOTS.length })}
              </span>
            </div>
            <div className="gap-space-sm relative z-10 grid grid-cols-12 items-center">
              <div className="relative col-span-5 flex flex-col items-center justify-center">
                <div className="from-surface-container to-surface-container-lowest relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b p-1 shadow-[0_0_24px_rgba(185,154,97,0.18)]">
                  <img
                    alt={heroName}
                    className="h-full w-full scale-105 transform rounded-lg object-cover transition-transform duration-300"
                    src={hero.image}
                  />
                  <div className="bg-surface-container-lowest/80 absolute bottom-1 rounded-full px-2 py-0.5 text-center backdrop-blur-xs">
                    <span className="font-caption text-caption text-primary tracking-wide">
                      {fill(t.inventory.hero, { n: level, name: heroName })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="col-span-7 flex flex-col space-y-1.5">
                {equippedSlots.map((slot) => {
                  const item = itemById.get(facts.equipped[slot]!)!;
                  return (
                    <div
                      key={slot}
                      data-equipped={slot}
                      className="bg-surface-container-low px-space-sm flex items-center justify-between rounded-lg py-1"
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <img alt="" src={item.image} className="h-[18px] w-[18px] shrink-0 rounded-sm object-cover" />
                        <div className="min-w-0">
                          <p
                            className={`font-caption text-caption truncate ${item.rarity === "epic" ? "text-tertiary" : "text-text-ivory"}`}
                          >
                            {tr(item.name, locale)}
                          </p>
                          <span
                            className={`font-caption inline-block rounded-sm px-1 py-[1px] text-[10px] tracking-wider uppercase ${RARITY_TAG[item.rarity]}`}
                          >
                            {tr(RARITY_LABEL[item.rarity], locale)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => equip(slot, null)}
                        className="font-label-sm text-text-muted hover:text-error ml-1 rounded-sm px-1 py-0.5 text-[11px] transition-colors active:scale-95"
                        title={t.inventory.takeOffTitle}
                      >
                        {t.inventory.takeOff}
                      </button>
                    </div>
                  );
                })}
                {emptySlot ? (
                  <div className="bg-surface-container-lowest/60 px-space-sm flex items-center justify-between rounded-lg py-1">
                    <div className="flex items-center gap-1.5">
                      <Icon name="pets" className="text-outline text-[18px]" />
                      <p className="font-caption text-caption text-text-muted italic">
                        {fill(t.inventory.free, { slot: tr(SLOT_LABEL[emptySlot], locale) })}
                      </p>
                    </div>
                    <Link
                      href={`${base}/wardrobe`}
                      className="bg-surface-container-high text-primary hover:bg-primary hover:text-on-primary flex h-6 w-6 items-center justify-center rounded-full transition-all active:scale-90"
                      title={t.inventory.assign}
                      aria-label={t.inventory.assign}
                    >
                      <Icon name="add" className="text-[16px]" />
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="gap-space-xs flex items-center">
                <Icon name="backpack" className="text-tertiary text-[20px]" />
                <h3 className="font-headline-md text-title-sm text-text-ivory">{t.inventory.bag}</h3>
              </div>
              <span className="font-caption text-caption text-outline">{t.inventory.sort}</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist">
              {(
                [
                  ["all", fill(t.inventory.all, { n: count })],
                  ["gear", t.inventory.gear],
                  ["quest", t.inventory.quest],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  onClick={() => setFilter(id)}
                  className={
                    filter === id
                      ? "bg-primary text-on-primary font-label-sm text-label-sm rounded-full px-3 py-1.5 font-medium whitespace-nowrap shadow-[0_0_12px_rgba(228,194,133,0.3)] transition-transform active:scale-95"
                      : "bg-surface-container-high text-on-surface-variant hover:text-text-ivory font-label-sm text-label-sm rounded-full px-3 py-1.5 whitespace-nowrap transition-colors active:scale-95"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            {error ? (
              <p role="alert" className="font-caption text-caption text-status-error text-center">
                {t.common.actionFailed}
              </p>
            ) : null}
            <div className="gap-space-sm grid grid-cols-2 pt-1">
              {filter !== "quest"
                ? owned.map((item) => (
                    <GearCard
                      key={item.id}
                      item={item}
                      worn={facts.equipped[item.slot] === item.id}
                      tooLow={level < item.level}
                      pending={pending}
                      onEquip={() => equip(item.slot, item.id)}
                    />
                  ))
                : null}
              {filter !== "gear"
                ? clues.map(({ chapter, clue }) => (
                    <div
                      key={clue.id}
                      data-clue={clue.id}
                      className="bg-surface-container p-space-sm from-surface-container to-surface-container-low relative flex flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-b shadow-xs"
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="bg-tertiary-container/30 text-tertiary flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg">
                          <img alt="" src={clue.image} className="h-full w-full object-cover" />
                        </div>
                        <span className="font-caption bg-tertiary/20 text-tertiary rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase">
                          {fill(t.inventory.questTag, { chapter: tr(chapter.label, locale) })}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-body-md text-body-md text-text-ivory truncate font-medium">{tr(clue.title, locale)}</h4>
                        <p className="font-caption text-caption text-outline truncate">{clue.english}</p>
                      </div>
                      <Link
                        href={`${base}/journal`}
                        className="bg-tertiary/20 hover:bg-tertiary/30 text-tertiary font-label-sm text-label-sm mt-2.5 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 transition-transform active:scale-95"
                      >
                        <Icon name="search" className="text-[14px]" />
                        <span>{t.inventory.inspect}</span>
                      </Link>
                    </div>
                  ))
                : null}
              {filter !== "quest"
                ? locked.map((item) => (
                    <div
                      key={item.id}
                      data-item={item.id}
                      className="bg-surface-container-lowest/80 p-space-sm relative flex flex-col justify-between overflow-hidden rounded-xl opacity-75"
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="bg-surface-container text-text-muted flex h-10 w-10 items-center justify-center rounded-lg">
                          <Icon name="lock" className="text-[24px]" />
                        </div>
                        <span className="font-caption bg-error-container/40 text-error rounded-sm px-1.5 py-0.5 text-[10px] font-medium">
                          {fill(t.inventory.levelTag, { n: item.level })}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-body-md text-body-md text-text-muted truncate font-medium">{tr(item.name, locale)}</h4>
                        <p className="font-caption text-caption text-outline truncate">{tr(item.note, locale)}</p>
                      </div>
                      <div className="bg-surface-container text-outline font-label-sm text-label-sm mt-2.5 flex w-full cursor-not-allowed items-center justify-center gap-1 rounded-lg py-1.5">
                        <Icon name="lock" className="text-[14px]" />
                        <span>{t.inventory.locked}</span>
                      </div>
                    </div>
                  ))
                : null}
            </div>
          </section>

          <footer className="flex flex-col space-y-2 pt-2">
            <Link
              href={`${base}/wardrobe`}
              className="text-surface-container-lowest font-label-md text-label-md flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#D5B87E] to-[#B99A61] font-semibold tracking-wider uppercase shadow-[0_0_16px_rgba(185,154,97,0.3)] transition-all active:scale-[0.98]"
            >
              <span>{t.inventory.toWardrobe}</span>
              <Icon name="arrow_forward" className="text-[20px]" />
            </Link>
            <div className="px-space-xs flex items-start gap-2 py-1">
              <Icon name="info" className="text-outline mt-0.5 shrink-0 text-[16px]" />
              <p className="font-caption text-caption text-text-muted leading-tight">{t.inventory.note}</p>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}

function GearCard({
  item,
  worn,
  tooLow,
  pending,
  onEquip,
}: {
  item: Item;
  worn: boolean;
  tooLow: boolean;
  pending: boolean;
  onEquip: () => void;
}) {
  const { t, locale } = useStudent();
  return (
    <div
      data-item={item.id}
      className={`bg-surface-container p-space-sm group relative flex flex-col justify-between overflow-hidden rounded-xl ${item.rarity === "epic" ? "shadow-[0_0_16px_rgba(185,154,97,0.12)]" : "shadow-xs"}`}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="bg-surface-container-highest flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg">
          <img alt="" src={item.image} className="h-full w-full object-cover" />
        </div>
        <span className={`font-caption rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${RARITY_TAG[item.rarity]}`}>
          {tr(RARITY_LABEL[item.rarity], locale)}
        </span>
      </div>
      <div>
        <h4 className="font-body-md text-body-md text-text-ivory truncate font-medium">{tr(item.name, locale)}</h4>
        <p className="font-caption text-caption text-outline truncate">{tr(item.note, locale)}</p>
      </div>
      {worn ? (
        <div className="bg-surface-container-highest text-primary font-label-sm text-label-sm mt-2.5 flex w-full cursor-default items-center justify-center gap-1 rounded-lg py-1.5 opacity-90">
          <Icon name="check" className="text-[14px]" />
          <span>{t.inventory.worn}</span>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending || tooLow}
          onClick={onEquip}
          className="bg-surface-container-high hover:bg-surface-bright text-text-ivory font-label-sm text-label-sm mt-2.5 w-full rounded-lg py-1.5 transition-transform active:scale-95 disabled:opacity-50"
        >
          {tooLow ? fill(t.inventory.levelTag, { n: item.level }) : t.wardrobe.putOn}
        </button>
      )}
    </div>
  );
}
