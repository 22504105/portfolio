import { characters } from "@/lib/content/characters";
import { tr } from "@/lib/content/text";
import type { Facts } from "@/lib/game/facts";
import { studentCampaigns } from "@/lib/game/world";
import { questHref } from "./story";
import { balance, chestReady, completed, currentChapter, currentStreak, dailyEntry, dailyQuests, levelOf, rankOf } from "@/lib/game/stats";
import type { Locale } from "@/lib/i18n";

// What the Home screen shows, worked out from the student's facts. The screen renders this
// and nothing else, so the same component serves the demo and the signed-in student.

export type HomeView = {
  hero: {
    name: string;
    rank: string;
    level: number;
    /** Picture of the student's chosen character, full body. */
    image: string;
    streakDays: number;
    coins: number;
    xp: { current: number; next: number };
  };
  featured: {
    chapter: string;
    cefr: string;
    title: string;
    image: string;
    /** Where "Продолжить" leads: the chapter being played. */
    continueHref: string;
    mapHref: string;
  };
  dailyQuests: { id: string; title: string; description: string; xp: number; image: string; tone: "gold" | "violet"; href: string }[];
  word: { word: string; translation: string; example: string; href: string };
  unreadNotifications: boolean;
};

export function homeView(facts: Facts, locale: Locale, base: string, today: string): HomeView {
  const character = characters[facts.profile.characterId ?? "cat"];
  const { level, into, next } = levelOf(balance(facts, "xp"));
  // Once every campaign is finished, the last chapter played stays featured.
  const current = currentChapter(facts);
  const chapter = current?.chapter ?? studentCampaigns(facts).at(-1)!.chapters.at(-1)!;
  const entry = dailyEntry(today);
  return {
    hero: {
      name: facts.profile.heroName ?? tr(character.name, locale),
      rank: tr(rankOf(level), locale),
      level,
      image: character.image,
      streakDays: currentStreak(facts, today),
      coins: balance(facts, "coins"),
      xp: { current: into, next },
    },
    featured: {
      chapter: tr(chapter.label, locale),
      cefr: chapter.cefr,
      title: tr(chapter.title, locale),
      image: chapter.image,
      continueHref: questHref(base, current?.campaign ?? studentCampaigns(facts).at(-1)!, chapter),
      mapHref: `${base}/map`,
    },
    dailyQuests: dailyQuests(today)
      .slice(0, 2)
      .map((quest) => ({
        id: quest.id,
        title: tr(quest.title, locale),
        description: tr(quest.topic, locale),
        xp: quest.xp,
        image: quest.image,
        tone: quest.tone,
        href: `${base}/quests/${quest.id}`,
      })),
    word: {
      word: entry.word.text,
      translation: tr(entry.word.translation, locale),
      example: entry.word.example,
      href: `${base}/discovery`,
    },
    // Something is waiting on the rewards screen: an unopened chest, or the day's discovery unclaimed.
    unreadNotifications: chestReady(facts, today) || !completed(facts, "daily_claim", today),
  };
}

/** XP bar fill, 0–100, never NaN or past the end. */
export function xpPercent(current: number, next: number): number {
  if (!(next > 0) || !(current > 0)) return 0;
  return Math.min(100, Math.round((current / next) * 100));
}
