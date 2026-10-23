import type { HomeView } from "@/lib/student/home";

// Demo data, shown only under /demo with the "Демо" label. Values are the ones of
// the approved Stitch screen. Nothing here is a real student or real usage.
export const demoHome: HomeView = {
  hero: {
    name: "Мяулин Чародей",
    rank: "Ученик Мага",
    level: 7,
    image: "/images/hero-cat-wizard.webp",
    streakDays: 6,
    coins: 850,
    xp: { current: 340, next: 500 },
  },
  featured: {
    chapter: "Глава II",
    cefr: "A2",
    title: "Тайна забытой башни",
    image: "/images/forgotten-tower.webp",
    continueHref: "/demo/play",
    mapHref: "/demo/map",
  },
  dailyQuests: [
    {
      id: "letter",
      title: "Разгадай письмо",
      description: "Прочти и найди подсказку.",
      xp: 50,
      image: "/images/sealed-letter.webp",
      tone: "gold",
      href: "/demo/quests/letter",
    },
    {
      id: "mist",
      title: "Слова из тумана",
      description: "Собери 5 новых слов.",
      xp: 30,
      image: "/images/rune-spellbook.webp",
      tone: "violet",
      href: "/demo/quests/mist",
    },
  ],
  word: { word: "whisper", translation: "шёпот, шептать", example: "The walls whisper ancient secrets.", href: "/demo/discovery" },
  unreadNotifications: true,
};
