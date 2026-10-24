"use client";

import { Icon } from "@/components/ui/icon";
import type { Dictionary } from "@/lib/i18n";
import { fill } from "@/lib/i18n";

// The puzzle chamber's stone slots and word tiles (06_interactive_puzzle), as one control:
// tapping a tile puts it in the first empty slot, tapping a filled slot gives the word back.
// Used by the story's ciphers and by the quick quests' word-order, gap and matching questions.

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

type Props = {
  t: Dictionary;
  tiles: string[];
  /** Words currently in the slots, by slot; null for an empty one. */
  slots: (string | null)[];
  onChange: (slots: (string | null)[]) => void;
  /** Captions over the slots instead of Roman numerals (matching: the left-hand words). */
  slotLabels?: string[];
  disabled?: boolean;
  title?: string;
};

export function TileBoard({ t, tiles, slots, onChange, slotLabels, disabled = false, title }: Props) {
  const used = slots.filter((word): word is string => word !== null);
  const filled = used.length;

  function place(tile: string) {
    if (disabled || used.includes(tile)) return;
    const empty = slots.indexOf(null);
    if (empty === -1) return;
    onChange(slots.map((word, i) => (i === empty ? tile : word)));
  }

  function giveBack(index: number) {
    if (disabled || slots[index] === null) return;
    onChange(slots.map((word, i) => (i === index ? null : word)));
  }

  const columns = slots.length <= 4 ? "grid-cols-4" : slots.length <= 6 ? "grid-cols-3" : "grid-cols-4";

  return (
    <>
      <div className="bg-surface p-space-md mb-space-md relative w-full rounded-xl shadow-xl">
        <div className="mb-space-sm flex items-center justify-between">
          <span className="font-title-sm text-title-sm text-primary flex items-center gap-1.5">
            <Icon name="token" className="text-[18px]" />
            {title ?? t.puzzle.slots}
          </span>
          <span className="font-caption text-caption text-text-muted" data-slot-counter>
            {fill(t.puzzle.counter, { n: filled, total: slots.length })}
          </span>
        </div>
        <div className={`gap-space-xs grid ${slotLabels ? "grid-cols-1" : columns}`}>
          {slots.map((word, index) => (
            <button
              key={index}
              type="button"
              data-slot={index}
              onClick={() => giveBack(index)}
              aria-label={word ? fill(t.puzzle.returnWord, { word }) : fill(t.puzzle.emptySlot, { n: index + 1 })}
              className={`group relative flex items-center justify-center rounded-lg p-1 shadow-inner transition-all active:scale-95 ${
                slotLabels ? "h-12 flex-row justify-between px-3" : "h-16 flex-col"
              } ${word ? "bg-surface-container-highest shadow-[0_0_12px_rgba(208,188,255,0.2)]" : "bg-surface-container-lowest"}`}
            >
              <span className={`font-caption text-caption font-semibold ${slotLabels ? "text-text-ivory" : "text-text-muted/40 mb-0.5"}`}>
                {slotLabels ? slotLabels[index] : NUMERALS[index]}
              </span>
              {word ? (
                <span className="font-headline-md text-body-lg text-primary line-clamp-1 text-center break-all">{word}</span>
              ) : (
                <Icon name="radio_button_unchecked" className="text-outline-variant/30 text-[18px]" />
              )}
            </button>
          ))}
        </div>
        <p className="font-caption text-caption text-text-muted/70 mt-space-xs text-center">{t.puzzle.tapSlot}</p>
      </div>

      <div className="bg-surface-container-low p-space-md mb-space-md w-full rounded-xl shadow-md">
        <div className="mb-space-sm flex items-center justify-between">
          <span className="font-label-sm text-label-sm text-text-muted tracking-wider uppercase">{t.puzzle.fragments}</span>
          <span className="font-caption text-caption text-secondary flex items-center gap-1">
            <Icon name="touch_app" className="text-[14px]" /> {t.puzzle.tapTile}
          </span>
        </div>
        <div className="gap-space-sm grid grid-cols-2">
          {tiles.map((tile) => {
            const taken = used.includes(tile);
            return (
              <button
                key={tile}
                type="button"
                data-tile={tile}
                disabled={disabled || taken}
                onClick={() => place(tile)}
                className={`px-space-md py-space-sm bg-surface-container-high text-text-ivory hover:bg-surface-bright flex min-h-[48px] items-center justify-between rounded-lg shadow-sm transition-all active:scale-95 ${
                  taken ? "pointer-events-none opacity-25" : ""
                }`}
              >
                <span className="font-title-sm text-title-sm text-primary-fixed">{tile}</span>
                <Icon name="north_east" className="text-primary/60 text-[18px]" />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
