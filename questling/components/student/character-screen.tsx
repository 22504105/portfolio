"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CHARACTER_IDS, characters, type CharacterId } from "@/lib/content/characters";
import { tr } from "@/lib/content/text";
import { setSound, useSoundOn } from "@/lib/client/sound";
import { useStudent } from "@/lib/client/student";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/12_character_select/code.html.
// The export cuts its portraits out of a reference sheet with labels on it (ASSET_AUDIT.md);
// here each card shows the character's own standalone base model instead. Choosing is free
// and can be changed later from the profile (the pencil next to the hero's name).

export function CharacterScreen() {
  const { t, locale, base, facts, act } = useStudent();
  const router = useRouter();
  const soundOn = useSoundOn();
  const [picked, setPicked] = useState<CharacterId>(facts.profile.characterId ?? "cat");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const current = characters[picked];
  const firstTime = !facts.profile.characterId;

  function confirm() {
    setError(false);
    startTransition(async () => {
      const result = await act({ type: "chooseCharacter", characterId: picked });
      if (result.ok) router.push(`${base}/home`);
      else setError(true);
    });
  }

  return (
    <div data-scope="select" className="flex min-h-dvh items-start justify-center bg-black antialiased">
      <div className="bg-graphite relative flex min-h-dvh w-full max-w-[390px] flex-col justify-between overflow-hidden border-x border-[#232130] shadow-2xl">
        <div className="flex flex-1 flex-col overflow-y-auto px-4 pt-3 pb-24">
          <header className="flex items-center justify-between border-b border-[#2d2838] py-2">
            <Link
              href={firstTime ? `${base}/welcome` : `${base}/profile`}
              aria-label={t.common.back}
              className="bg-graphite-surface/80 border-graphite-borderGold/40 text-gold flex h-9 w-9 items-center justify-center rounded-full border transition-transform active:scale-95"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
              </svg>
            </Link>
            <div className="flex items-center gap-1.5">
              <span className="text-gold text-xs">✦</span>
              <span className="font-cormorant text-arcana-ivory text-base font-semibold tracking-wider">{t.select.header}</span>
              <span className="text-gold text-xs">✦</span>
            </div>
            <button
              type="button"
              aria-label={t.welcome.sound}
              aria-pressed={soundOn}
              onClick={() => setSound(!soundOn)}
              className={`bg-graphite-surface/80 border-graphite-borderGold/40 flex h-9 w-9 items-center justify-center rounded-full border transition-transform active:scale-95 ${
                soundOn ? "text-arcana-ivory/80" : "text-arcana-muted/50"
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                ></path>
              </svg>
            </button>
          </header>

          <section className="mt-4 mb-3 text-center">
            <h1 className="font-cormorant text-arcana-ivory text-[28px] leading-tight font-bold tracking-wide">{t.select.title}</h1>
            <p className="text-arcana-muted mx-auto mt-1.5 max-w-[320px] text-xs leading-relaxed">{t.select.lead}</p>
          </section>

          <section className="mb-4 grid grid-cols-2 gap-3" role="radiogroup" aria-label={t.select.title}>
            {CHARACTER_IDS.map((id) => {
              const character = characters[id];
              const selected = id === picked;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-character={id}
                  onClick={() => setPicked(id)}
                  className={
                    selected
                      ? "bg-graphite-surface border-gold shadow-gold-glow ring-arcana-violet/40 relative flex cursor-pointer flex-col items-center rounded-2xl border-2 p-2.5 ring-1"
                      : "bg-graphite-surface border-graphite-border hover:border-gold/50 shadow-arcana-card group relative flex cursor-pointer flex-col items-center rounded-2xl border p-2.5 transition-all"
                  }
                >
                  {selected ? (
                    <div className="bg-gold text-graphite absolute -top-1.5 -right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow-md">
                      <svg className="h-3.5 w-3.5 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </div>
                  ) : null}
                  <div
                    className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl ${
                      selected
                        ? "border-gold/40 border bg-gradient-to-b from-[#382d4d] via-[#241f38] to-[#181524]"
                        : "bg-gradient-to-b from-[#282638] to-[#161520]"
                    }`}
                  >
                    {selected ? (
                      <div className="from-arcana-violet/30 absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] via-transparent to-transparent"></div>
                    ) : null}
                    <img
                      alt={tr(character.species, locale)}
                      className="relative z-0 h-full w-full origin-[50%_22%] scale-[1.3] transform object-cover transition-transform"
                      src={character.image}
                    />
                  </div>
                  <div className="mt-2.5 w-full text-center">
                    {selected ? (
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-gold text-[10px]">✦</span>
                        <h3 className="font-cormorant text-gold text-base leading-none font-bold">{tr(character.name, locale)}</h3>
                        <span className="text-gold text-[10px]">✦</span>
                      </div>
                    ) : (
                      <h3 className="font-cormorant text-arcana-ivory text-base leading-none font-bold">{tr(character.name, locale)}</h3>
                    )}
                    <p className={`mt-0.5 text-[10px] ${selected ? "text-arcana-violet font-medium" : "text-arcana-muted"}`}>
                      {tr(character.role, locale)}
                    </p>
                  </div>
                  <div className="mt-2 flex w-full justify-center">
                    {selected ? (
                      <span className="bg-gold/15 text-gold border-gold/40 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold">
                        {t.select.chosen}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-[#2b593f] bg-[#1e2e25] px-2 py-0.5 text-[10px] font-medium text-[#7ce0a5]">
                        {t.select.free}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </section>

          <section className="border-graphite-borderGold relative flex items-center gap-3 rounded-xl border bg-gradient-to-r from-[#1C1B27] via-[#232035] to-[#1C1B27] p-3 shadow-md">
            <div className="border-gold/40 flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-black/40 p-0.5">
              <img alt="" className="h-full w-full object-contain" src={current.image} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-cormorant text-arcana-ivory truncate text-sm font-semibold">
                  {tr(current.species, locale)} <span className="text-gold font-normal">({tr(current.role, locale)})</span>
                </h4>
                <span className="text-arcana-violet bg-arcana-violet/10 rounded-sm px-1.5 py-0.5 text-[10px] font-medium">
                  {t.select.arcana}
                </span>
              </div>
              <p className="text-arcana-muted mt-0.5 line-clamp-2 text-[11px] leading-snug">{tr(current.about, locale)}</p>
            </div>
          </section>
        </div>

        <footer className="from-graphite via-graphite/95 fixed bottom-0 z-30 w-full max-w-[390px] bg-gradient-to-t to-transparent px-4 pt-6 pb-6">
          <div className="flex flex-col items-center">
            <button
              type="button"
              data-action="confirm-character"
              onClick={confirm}
              disabled={pending}
              aria-busy={pending}
              className="from-gold via-gold-light to-gold shadow-gold-glow flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r text-sm font-bold tracking-wide text-[#101016] transition-transform active:scale-[0.98] disabled:opacity-70"
            >
              <span>{t.select.confirm}</span>
              <svg className="h-4 w-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </button>
            {error ? (
              <p role="alert" className="text-status-error mt-2 text-center text-[11px]">
                {t.common.actionFailed}
              </p>
            ) : (
              <p className="text-arcana-muted/80 mt-2.5 text-center text-[11px] leading-none">{t.select.note}</p>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
