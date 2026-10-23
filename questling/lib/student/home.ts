// What the Home screen shows. The screen renders this and nothing else, so the
// same component serves the demo and, from Gate 2, the signed-in student.

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
    /** Where "Продолжить" leads: the run to resume or the quest to start. */
    continueHref: string;
    mapHref: string;
  };
  dailyQuests: { id: string; title: string; description: string; xp: number; image: string; tone: "gold" | "violet"; href: string }[];
  word: { word: string; translation: string; example: string; href: string };
  unreadNotifications: boolean;
};

/** "6 дней", "1 день", "3 дня": Russian plural forms. */
export function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} дня`;
  return `${n} дней`;
}

/** XP bar fill, 0–100, never NaN or past the end. */
export function xpPercent(current: number, next: number): number {
  if (!(next > 0) || !(current > 0)) return 0;
  return Math.min(100, Math.round((current / next) * 100));
}
