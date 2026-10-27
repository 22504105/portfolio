"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { quickQuestById } from "@/lib/content/quick-quests";
import { tr } from "@/lib/content/text";
import { useNow, useStudent } from "@/lib/client/student";
import { assignedQuests, dailyQuests } from "@/lib/game/stats";
import { dayOf } from "@/lib/game/time";
import { worldOf } from "@/lib/game/world";
import { fill } from "@/lib/i18n";
import { OBJECTIVES } from "@/lib/learning/objectives";
import { questsFor, recommendations } from "@/lib/learning/recommend";
import { dueCards, reviewOptions, type VocabCard } from "@/lib/learning/vocab";
import { BackHeader } from "./back-header";
import { PronounceButton } from "./pronounce-button";

// The word journal (lib/learning/vocab.ts): today's review, what to practise (from the student's
// own mistakes, lib/learning/recommend.ts), and the kept words with search and filters. No Stitch
// screen exists for it, so it is put together from approved parts only: the story player's
// header, the daily discovery's word card and quiz rows (09), the quests' filter chips (08) and
// the profile's rows (11).

type Filter = "all" | "favorite" | "story" | "daily" | "known";
const LETTERS = { ru: ["А", "Б", "В", "Г"], en: ["A", "B", "C", "D"] };

export function WordsScreen() {
  const { t, locale, base, facts, mode } = useStudent();
  const today = dayOf(useNow());
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const due = dueCards(facts, today);
  // Practice suggestions, unless a teacher turned them off for the student's group.
  const suggest = !worldOf(facts).groups.some((g) => g.recommend === false);
  const gaps = suggest ? recommendations(facts) : [];
  const available = new Set([...dailyQuests(today), ...assignedQuests(facts, mode === "demo")].map((q) => q.id));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...facts.vocab]
      .filter((c) =>
        filter === "favorite"
          ? c.favorite
          : filter === "story"
            ? c.source.startsWith("story:")
            : filter === "daily"
              ? c.source === "daily"
              : filter === "known"
                ? c.known
                : true,
      )
      .filter((c) => !q || c.term.toLowerCase().includes(q) || c.ru.toLowerCase().includes(q))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }, [facts.vocab, filter, query]);

  const filters: { id: Filter; label: string }[] = (["all", "favorite", "story", "daily", "known"] as const).map((id) => ({
    id,
    label: t.words.filters[id],
  }));

  return (
    <div className="bg-background font-body-md text-body-md text-on-surface flex min-h-dvh flex-col antialiased" data-screen="words">
      <BackHeader title={t.words.title} backHref={`${base}/profile`} profileHref={`${base}/profile`} t={t} />
      <main className="pb-safe px-margin mx-auto flex w-full max-w-[420px] flex-1 flex-col gap-6 pt-20 pb-10">
        {reviewing ? (
          <Review cards={due} today={today} onDone={() => setReviewing(false)} />
        ) : (
          <section className="bg-surface-container-low p-space-md flex flex-col gap-3 rounded-lg shadow-inner" data-review-card>
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-primary flex items-center gap-1.5 tracking-wider uppercase">
                <Icon name="history_edu" className="text-[16px]" /> {t.words.review}
              </span>
            </div>
            <p className="font-body-md text-body-md text-text-ivory">
              {due.length ? fill(t.words.reviewDue, { n: due.length }) : t.words.reviewNone}
            </p>
            {due.length ? (
              <button
                type="button"
                data-action="start-review"
                onClick={() => setReviewing(true)}
                className="text-surface-container-lowest font-label-md text-label-md flex h-11 items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-[#D5B87E] to-[#B99A61] font-semibold tracking-wide shadow-[0_0_16px_rgba(185,154,97,0.3)] active:scale-[0.98]"
              >
                <Icon name="auto_stories" className="text-[18px]" /> {t.words.start}
              </button>
            ) : null}
          </section>
        )}

        {suggest ? (
          <section className="flex flex-col gap-2" data-practice>
            <div className="flex items-center gap-1.5 px-1">
              <Icon name="psychology" className="text-secondary text-[18px]" />
              <h2 className="font-headline-md text-headline-md text-text-ivory">{t.words.practice}</h2>
            </div>
            <p className="font-caption text-caption text-text-muted px-1">{t.words.practiceNote}</p>
            {gaps.length ? (
              <ul className="flex flex-col gap-2">
                {gaps.map((gap) => {
                  const quest = questsFor(gap.objective).find((id) => available.has(id));
                  return (
                    <li
                      key={gap.objective}
                      data-gap={gap.objective}
                      className="bg-secondary-container/30 p-space-md flex flex-col gap-1 rounded-xl shadow-[0_0_24px_rgba(82,58,138,0.15)]"
                    >
                      <span className="font-title-sm text-title-sm text-text-ivory">{tr(OBJECTIVES[gap.objective], locale)}</span>
                      <span className="font-caption text-caption text-on-surface-variant">
                        {fill(t.words.gap, { errors: gap.errors, n: gap.of })}
                      </span>
                      {quest ? (
                        <Link
                          href={`${base}/quests/${quest}`}
                          className="font-label-md text-label-md text-primary mt-1 flex items-center gap-1"
                        >
                          {fill(t.words.gapQuest, { quest: tr(quickQuestById.get(quest)!.title, locale) })}
                          <Icon name="chevron_right" className="text-[18px]" />
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="font-body-md text-body-md text-on-surface-variant px-1">{t.words.noGaps}</p>
            )}
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <label className="bg-surface-container flex items-center gap-2 rounded-lg px-3 py-2 shadow-xs">
            <Icon name="search" className="text-text-muted text-[18px]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.words.search}
              aria-label={t.words.search}
              className="text-text-ivory font-body-md text-body-md placeholder:text-text-muted w-full bg-transparent focus:outline-none"
            />
          </label>
          <div
            className="gap-space-xs -mx-gutter px-gutter flex items-center overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none" }}
            role="tablist"
          >
            {filters.map((option) => {
              const active = option.id === filter;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-filter={option.id}
                  onClick={() => setFilter(option.id)}
                  className={
                    active
                      ? "px-space-md bg-primary text-on-primary font-label-sm text-label-sm rounded-full py-1.5 whitespace-nowrap shadow-[0_0_12px_rgba(228,194,133,0.3)]"
                      : "px-space-md bg-surface-container-high text-text-ivory hover:text-primary font-label-sm text-label-sm rounded-full py-1.5 whitespace-nowrap shadow-xs"
                  }
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {shown.length ? (
            <ul className="flex flex-col gap-2" data-word-list>
              {shown.map((card) => (
                <WordRow key={card.ref} card={card} />
              ))}
            </ul>
          ) : (
            <p className="font-body-md text-body-md text-on-surface-variant py-4 text-center">
              {facts.vocab.length ? t.words.nothing : t.words.empty}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

function WordRow({ card }: { card: VocabCard }) {
  const { t, act } = useStudent();
  const [pending, startTransition] = useTransition();
  const send = (action: Parameters<typeof act>[0]) => startTransition(async () => void (await act(action)));
  return (
    <li className="bg-surface-container-low p-space-md flex flex-col gap-1.5 rounded-lg shadow-xs" data-word={card.ref} aria-busy={pending}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span lang="en" className="font-title-sm text-title-sm text-text-ivory">
            {card.term}
          </span>
          <PronounceButton word={card.term} label={fill(t.gloss.listen, { phrase: card.term })} />
          {card.cefr ? (
            <span className="bg-secondary-container/40 text-secondary-fixed font-label-sm rounded-full px-2 py-0.5 text-[10px]">
              {card.cefr}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center">
          <IconButton
            icon={card.favorite ? "star" : "star_outline"}
            label={fill(card.favorite ? t.words.unfavorite : t.words.favorite, { term: card.term })}
            active={card.favorite}
            onClick={() => send({ type: "flagWord", ref: card.ref, favorite: !card.favorite })}
          />
          <IconButton
            icon={card.known ? "check_circle" : "radio_button_unchecked"}
            label={fill(card.known ? t.words.unknown : t.words.known, { term: card.term })}
            active={card.known}
            onClick={() => send({ type: "flagWord", ref: card.ref, known: !card.known })}
          />
          <IconButton
            icon="delete"
            label={fill(t.words.drop, { term: card.term })}
            onClick={() => send({ type: "dropWord", ref: card.ref })}
          />
        </div>
      </div>
      <span lang="ru" className="font-body-md text-body-md text-on-surface-variant">
        {card.ru}
      </span>
      {card.example ? (
        <span lang="en" className="font-caption text-caption text-text-muted italic">
          “{card.example}”
        </span>
      ) : null}
      <span className="font-caption text-caption text-text-muted text-[11px]">
        {card.source === "daily" ? t.words.fromDaily : t.words.fromStory}
      </span>
    </li>
  );
}

function IconButton({ icon, label, onClick, active = false }: { icon: WordIcon; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={icon === "delete" ? undefined : active}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full transition-colors ${active ? "text-primary" : "text-text-muted hover:text-text-ivory"}`}
    >
      <Icon name={icon} className="text-[20px]" />
    </button>
  );
}

type WordIcon = "star" | "star_outline" | "check_circle" | "radio_button_unchecked" | "delete";

/** A review session over today's due cards, one at a time: pick the meaning, see the answer, go on. */
function Review({ cards, today, onDone }: { cards: VocabCard[]; today: string; onDone: () => void }) {
  const { t, locale, facts, act } = useStudent();
  // The session's cards are fixed when it starts: a reviewed card leaves "due" but stays on screen until "next".
  const [queue] = useState(() => cards.map((c) => c.ref));
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<{ chosen: string; right: string; correct: boolean; due: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const card = facts.vocab.find((c) => c.ref === queue[index]);
  // The options as they were when the card was asked (its schedule changes once answered).
  const [options, setOptions] = useState(() => (card ? reviewOptions(facts, card, today) : []));
  if (!card) return null;

  const choose = (id: string) => {
    if (result || pending) return;
    setFailed(false);
    startTransition(async () => {
      const done = await act({ type: "reviewWord", ref: card.ref, option: id });
      if (!done.ok || done.outcome.kind !== "review") {
        setFailed(true);
        return;
      }
      setResult({ chosen: id, right: done.outcome.right, correct: done.outcome.correct, due: done.outcome.due });
    });
  };

  const next = () => {
    if (index + 1 >= queue.length) return onDone();
    const following = facts.vocab.find((c) => c.ref === queue[index + 1]);
    setOptions(following ? reviewOptions(facts, following, today) : []);
    setResult(null);
    setIndex(index + 1);
  };

  const days = result ? Math.max(1, Math.round((Date.parse(result.due) - Date.parse(today)) / 86_400_000)) : 0;

  return (
    <section className="bg-surface-container-low p-space-md flex flex-col gap-3 rounded-lg shadow-inner" data-review={card.ref}>
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-label-sm text-primary tracking-wider uppercase">{t.words.review}</span>
        <span className="font-caption text-caption text-text-muted">
          {index + 1} / {queue.length}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span lang="en" className="font-headline-md text-headline-md text-text-ivory">
          {card.term}
        </span>
        <PronounceButton word={card.term} label={fill(t.gloss.listen, { phrase: card.term })} />
      </div>
      <p className="font-body-md text-body-md text-on-surface-variant">{t.words.question}</p>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label={t.words.question}>
        {options.map((option, i) => {
          const right = result?.right === option.id;
          const wrong = result && result.chosen === option.id && !result.correct;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={result?.chosen === option.id}
              data-option={option.id}
              disabled={!!result || pending}
              onClick={() => choose(option.id)}
              className={`flex w-full items-center gap-3 rounded-lg p-3 text-left shadow-xs transition-all active:scale-[0.99] ${
                right
                  ? "bg-status-success/20 text-status-success"
                  : wrong
                    ? "bg-status-error/20 text-status-error"
                    : "bg-surface text-text-ivory"
              }`}
            >
              <span className="bg-surface-container-high font-label-sm text-label-sm text-text-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                {LETTERS[locale][i]}
              </span>
              <span lang="ru" className="font-body-md text-body-md">
                {option.text}
              </span>
            </button>
          );
        })}
      </div>
      {failed ? <p className="font-caption text-caption text-status-error">{t.common.actionFailed}</p> : null}
      {result ? (
        <>
          <p className={`font-label-md text-label-md ${result.correct ? "text-status-success" : "text-status-error"}`} role="status">
            {result.correct ? t.words.right : t.words.wrong} · {fill(t.words.nextReview, { n: days })}
          </p>
          <button
            type="button"
            data-action="next-word"
            onClick={next}
            className="bg-surface-container-high hover:bg-surface-bright text-text-ivory font-label-md text-label-md flex h-11 items-center justify-center rounded-lg uppercase shadow-xs"
          >
            {index + 1 >= queue.length ? t.words.finish : t.words.next}
          </button>
        </>
      ) : (
        <p className="font-caption text-caption text-text-muted">{t.words.reviewNote}</p>
      )}
    </section>
  );
}
