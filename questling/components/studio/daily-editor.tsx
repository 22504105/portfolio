"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { useNow } from "@/lib/client/student";
import { useStudio } from "@/lib/client/studio";
import { AudioField } from "./audio-field";
import { dayFromNumber, dayNumber, dayOf } from "@/lib/game/time";
import { fill } from "@/lib/i18n";
import type { DailyContent } from "@/lib/studio/model";

// The analytics screen's "Слово и факт дня" tab: the teacher's own word, fact and quiz of the day
// for the group in view, on a chosen day (setDaily). The group's students get it instead of the
// built-in feed on that day; the list below shows what is planned and can take an entry back.
// Built from the parts of 20_teacher_analytics (cards, fields, the gold action).

const LETTERS = ["a", "b", "c", "d"] as const;

const blank = (): DailyContent => ({
  word: { text: "", ipa: "", translation: { ru: "", en: "" }, example: "" },
  fact: { title: "", text: "", explanation: { ru: "", en: "" }, source: "" },
  quiz: { question: "", options: LETTERS.slice(0, 3).map((id) => ({ id, text: "" })), correct: "a" },
});

const field =
  "bg-surface-container-lowest text-text-ivory font-body-md text-body-md px-space-md py-space-sm focus:ring-primary w-full rounded-lg focus:ring-1 focus:outline-none";

export function DailyEditor() {
  const { t, facts, groupId, act } = useStudio();
  const now = useNow();
  const tomorrow = dayFromNumber(dayNumber(dayOf(now.toISOString())) + 1);
  const [day, setDay] = useState(tomorrow);
  const existing = facts.daily.find((d) => d.groupId === groupId && d.day === day);
  const [content, setContent] = useState<DailyContent>(() => structuredClone(existing?.content ?? blank()));
  const [loaded, setLoaded] = useState(`${groupId}|${day}`);
  const [state, setState] = useState<"idle" | "saved" | "invalid">("idle");
  const [pending, start] = useTransition();
  const a = t.analytics;

  // Another day or group loads what is planned there (React allows this update during render).
  if (loaded !== `${groupId}|${day}`) {
    setLoaded(`${groupId}|${day}`);
    setContent(structuredClone(existing?.content ?? blank()));
    setState("idle");
  }
  if (!groupId) return <p className="font-body-md text-body-md text-text-muted">{a.selectGroup}</p>;

  const edit = (fn: (c: DailyContent) => void) => {
    setContent((c) => {
      const next = structuredClone(c);
      fn(next);
      return next;
    });
    setState("idle");
  };
  const planned = facts.daily.filter((d) => d.groupId === groupId).sort((x, y) => x.day.localeCompare(y.day));
  const input = (label: string, value: string, set: (v: string) => void, area = false, name?: string) => (
    <label className="flex flex-col gap-1">
      <span className="font-label-sm text-label-sm text-text-muted">{label}</span>
      {area ? (
        <textarea className={`${field} resize-none`} rows={2} value={value} onChange={(e) => set(e.target.value)} name={name} />
      ) : (
        <input className={field} value={value} onChange={(e) => set(e.target.value)} name={name} />
      )}
    </label>
  );
  const pair = (label: string, value: { ru: string; en: string }, set: (v: { ru: string; en: string }) => void) => (
    <div className="grid grid-cols-2 gap-2">
      {input(`${label} (RU)`, value.ru, (ru) => set({ ...value, ru }))}
      {input(`${label} (EN)`, value.en, (en) => set({ ...value, en }))}
    </div>
  );

  return (
    <div className="gap-space-lg grid grid-cols-12 items-start" data-daily>
      <form
        className="p-space-xl bg-surface-container gap-space-lg col-span-12 flex flex-col rounded-xl shadow-xl lg:col-span-8"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const result = await act({ type: "setDaily", groupId, day, content });
            setState(result.ok ? "saved" : "invalid");
          });
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col">
            <h3 className="font-title-sm text-title-sm text-text-ivory">{a.dailyTitle}</h3>
            <p className="font-caption text-caption text-text-muted max-w-xl">{a.dailyNote}</p>
          </div>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-text-muted">{a.day}</span>
            <input className={field} type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} name="day" />
          </label>
        </div>

        <section className="p-space-md bg-surface-container-low gap-space-sm flex flex-col rounded-xl">
          <span className="gap-space-xs font-label-md text-label-md text-primary flex items-center">
            <Icon name="translate" className="text-[18px]" /> {a.word}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {input(a.wordText, content.word.text, (v) => edit((c) => (c.word.text = v)), false, "word")}
            {input(a.ipa, content.word.ipa, (v) => edit((c) => (c.word.ipa = v)))}
          </div>
          {pair(a.translation, content.word.translation, (v) => edit((c) => (c.word.translation = v)))}
          {input(a.example, content.word.example, (v) => edit((c) => (c.word.example = v)))}
          <AudioField value={content.word.audio} onChange={(v) => edit((c) => (v ? (c.word.audio = v) : delete c.word.audio))} />
        </section>

        <section className="p-space-md bg-surface-container-low gap-space-sm flex flex-col rounded-xl">
          <span className="gap-space-xs font-label-md text-label-md text-secondary flex items-center">
            <Icon name="lightbulb" className="text-[18px]" /> {a.fact}
          </span>
          {input(a.factTitle, content.fact.title, (v) => edit((c) => (c.fact.title = v)))}
          {input(a.factText, content.fact.text, (v) => edit((c) => (c.fact.text = v)), true)}
          {pair(a.explanation, content.fact.explanation, (v) => edit((c) => (c.fact.explanation = v)))}
          {input(a.source, content.fact.source, (v) => edit((c) => (c.fact.source = v)))}
        </section>

        <section className="p-space-md bg-surface-container-low gap-space-sm flex flex-col rounded-xl">
          <span className="gap-space-xs font-label-md text-label-md text-status-success flex items-center">
            <Icon name="quiz" className="text-[18px]" /> {a.quiz}
          </span>
          {input(a.question, content.quiz.question, (v) => edit((c) => (c.quiz.question = v)))}
          {content.quiz.options.map((o, i) => (
            <div key={o.id} className="flex items-end gap-2">
              <div className="flex-1">
                {input(fill(a.option, { letter: o.id.toUpperCase() }), o.text, (v) => edit((c) => (c.quiz.options[i].text = v)))}
              </div>
              <label
                className={`font-caption text-caption mb-2 flex items-center gap-1 ${content.quiz.correct === o.id ? "text-status-success" : "text-text-muted"}`}
              >
                <input
                  type="radio"
                  name="correct"
                  className="accent-[#63BA9E]"
                  checked={content.quiz.correct === o.id}
                  onChange={() => edit((c) => (c.quiz.correct = o.id))}
                />
                {a.correct}
              </label>
            </div>
          ))}
        </section>

        <div className="flex items-center justify-between gap-2">
          <span role="status" className={`font-caption text-caption ${state === "invalid" ? "text-status-error" : "text-status-success"}`}>
            {state === "saved" ? a.savedDaily : state === "invalid" ? a.invalidDaily : ""}
          </span>
          <button
            type="submit"
            disabled={pending}
            data-action="save-daily"
            className="gap-space-sm px-space-xl py-space-md font-label-md text-label-md flex items-center rounded-lg bg-gradient-to-b from-[#D5B87E] to-[#B99A61] font-semibold text-[#101016] shadow-[0_0_16px_rgba(185,154,97,0.25)] transition-all hover:brightness-105 disabled:opacity-50"
          >
            <Icon name="event_available" className="text-[20px]" />
            <span>{a.saveDaily}</span>
          </button>
        </div>
      </form>

      <aside className="p-space-lg bg-surface-container gap-space-md col-span-12 flex flex-col rounded-xl shadow-xl lg:col-span-4">
        <h3 className="font-title-sm text-title-sm text-text-ivory">{a.scheduled}</h3>
        {planned.length === 0 ? <p className="font-body-md text-body-md text-text-muted">{a.noScheduled}</p> : null}
        {planned.map((d) => (
          <div
            key={d.id}
            className={`p-space-sm flex items-center justify-between gap-2 rounded-lg ${d.day === day ? "bg-surface-container-high" : "bg-surface-container-low"}`}
          >
            <button type="button" onClick={() => setDay(d.day)} className="flex min-w-0 flex-col text-left">
              <span className="font-label-sm text-label-sm text-text-ivory">{d.day}</span>
              <span className="font-caption text-caption text-text-muted truncate">
                {d.content.word.text} • {d.content.fact.title}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void act({ type: "clearDaily", entryId: d.id })}
              className="font-caption text-caption text-text-muted hover:text-status-error shrink-0"
            >
              {a.clear}
            </button>
          </div>
        ))}
      </aside>
    </div>
  );
}
