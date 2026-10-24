import type { Locale } from "@/lib/i18n";
import type { ProfileView } from "@/lib/student/profile";

// Demo profile, shown only under /demo with the "Демо" label: the values of the approved
// 11_profile_2 screen, the English texts their translation. Not a real student or account.
export function demoProfile(locale: Locale): ProfileView {
  const ru = locale === "ru";
  return {
    name: ru ? "Барсик-Архивариус" : "Barsik the Archivist",
    level: 7,
    school: ru ? "Магия" : "Magic",
    title: ru ? "Искатель тайн" : "Secret Seeker",
    image: "/images/hero-cat-wizard.webp",
    coins: 850,
    streakDays: 6,
    xp: { label: ru ? "Опыт ранга Магии" : "Magic rank XP", current: 340, next: 500 },
    gear: [
      { id: "hat", name: ru ? "Шляпа волшебника" : "Wizard's hat", icon: "magic_button", tone: "gold" },
      { id: "cloak", name: ru ? "Мантия заката" : "Sunset cloak", icon: "palette", tone: "violet" },
      { id: "staff", name: ru ? "Посох" : "Staff", icon: "auto_fix_high", tone: "gold" },
    ],
    cefr: "A2",
    skills: [
      {
        id: "vocabulary",
        name: ru ? "Словарный запас" : "Vocabulary",
        detail: ru ? "142 изученных слова" : "142 words learnt",
        percent: 78,
        icon: "translate",
        tone: "primary",
      },
      {
        id: "grammar",
        name: ru ? "Грамматика заклинаний" : "Spell grammar",
        detail: "Past Simple, Questions",
        percent: 65,
        icon: "menu_book",
        tone: "secondary",
      },
      {
        id: "reading",
        name: ru ? "Чтение и поиск улик" : "Reading and clue hunting",
        detail: ru ? "12 разгаданных манускриптов" : "12 manuscripts solved",
        percent: 84,
        icon: "find_in_page",
        tone: "success",
      },
      {
        id: "listening",
        name: ru ? "Аудирование и шёпот" : "Listening and whispers",
        detail: ru ? "9 прослушанных диалогов" : "9 dialogues heard",
        percent: 50,
        icon: "headphones",
        tone: "tertiary",
      },
    ],
    wardrobeNote: ru ? "Мантия, шляпа архимага и посох" : "Cloak, archmage's hat and staff",
    inventoryNote: ru ? "Свитки, древние печати и реликвии" : "Scrolls, ancient seals and relics",
    group: { name: ru ? "Детективы A2" : "A2 Detectives", mentor: ru ? "Архимаг Элеонора" : "Archmage Eleanor" },
    telegram: { username: "barsik_magic", id: 89214 },
  };
}
