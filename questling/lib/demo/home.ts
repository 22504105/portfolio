import type { Locale } from "@/lib/i18n";
import type { HomeView } from "@/lib/student/home";

// Demo data, shown only under /demo with the "Демо" label. Values are the ones of
// the approved Stitch screen; the English texts are their translation. Nothing here
// is a real student or real usage.
export function demoHome(locale: Locale): HomeView {
  const ru = locale === "ru";
  const base = `/${locale}/demo`;
  return {
    hero: {
      name: ru ? "Мяулин Чародей" : "Meowlin the Enchanter",
      rank: ru ? "Ученик Мага" : "Mage Apprentice",
      level: 7,
      image: "/images/hero-cat-wizard.webp",
      streakDays: 6,
      coins: 850,
      xp: { current: 340, next: 500 },
    },
    featured: {
      chapter: ru ? "Глава II" : "Chapter II",
      cefr: "A2",
      title: ru ? "Тайна забытой башни" : "The Secret of the Forgotten Tower",
      image: "/images/forgotten-tower.webp",
      continueHref: `${base}/play`,
      mapHref: `${base}/map`,
    },
    dailyQuests: [
      {
        id: "letter",
        title: ru ? "Разгадай письмо" : "Decipher the letter",
        description: ru ? "Прочти и найди подсказку." : "Read it and find the clue.",
        xp: 50,
        image: "/images/sealed-letter.webp",
        tone: "gold",
        href: `${base}/quests/letter`,
      },
      {
        id: "mist",
        title: ru ? "Слова из тумана" : "Words from the mist",
        description: ru ? "Собери 5 новых слов." : "Collect 5 new words.",
        xp: 30,
        image: "/images/rune-spellbook.webp",
        tone: "violet",
        href: `${base}/quests/mist`,
      },
    ],
    word: {
      word: "whisper",
      translation: ru ? "шёпот, шептать" : "a very soft voice; to speak very softly",
      example: "The walls whisper ancient secrets.",
      href: `${base}/discovery`,
    },
    unreadNotifications: true,
  };
}
