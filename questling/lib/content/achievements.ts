import type { Text } from "./text";

// The four achievements of 10_rewards. Progress is counted from the student's own record
// (lib/game/stats.ts); an achievement is granted once, by the server, when its goal is met.

export type AchievementId = "first-clue" | "seven-days" | "moon-library" | "rune-master";
export type AchievementIcon = "key" | "history_edu" | "auto_stories" | "fingerprint";

export type Achievement = {
  id: AchievementId;
  title: Text;
  description: Text;
  icon: AchievementIcon;
  /** What is counted, and how many are needed. */
  metric: "clues" | "bestStreak" | "readingFirstTry" | "ciphersFirstTry";
  goal: number;
  reward: { coins: number } | { item: string };
};

export const achievements: Achievement[] = [
  {
    id: "first-clue",
    title: { ru: "Первая улика", en: "First clue" },
    description: { ru: "Разгадай первую тайну в архивах.", en: "Solve your first mystery in the archives." },
    icon: "key",
    metric: "clues",
    goal: 1,
    reward: { coins: 50 },
  },
  {
    id: "seven-days",
    title: { ru: "Семидневный учёный", en: "Seven-day scholar" },
    description: { ru: "Занимайся 7 дней без пропусков.", en: "Study 7 days in a row." },
    icon: "history_edu",
    metric: "bestStreak",
    goal: 7,
    reward: { coins: 100 },
  },
  {
    id: "moon-library",
    title: { ru: "Лунная библиотека", en: "Moon library" },
    description: { ru: "Прочти 10 рукописей без подсказок.", en: "Read 10 manuscripts without a hint." },
    icon: "auto_stories",
    metric: "readingFirstTry",
    goal: 10,
    reward: { item: "star-crown" },
  },
  {
    id: "rune-master",
    title: { ru: "Повелитель рун", en: "Lord of runes" },
    description: { ru: "Собери 20 шифров без ошибок.", en: "Solve 20 ciphers without a mistake." },
    icon: "fingerprint",
    metric: "ciphersFirstTry",
    goal: 20,
    reward: { coins: 250 },
  },
];

/** Quest completions in one week that open the weekly chest. */
export const WEEKLY_CHEST_GOAL = 5;
