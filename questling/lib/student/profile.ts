// What the Profile screen shows (11_profile_2). Like HomeView: the screen renders this
// and nothing else, so the demo and, from Gate 2, the signed-in student share the component.

/** Icons chosen by data; scripts/build-icons.mjs reads these unions to put them in the icon font. */
export type GearIcon = "magic_button" | "palette" | "auto_fix_high";
export type SkillIcon = "translate" | "menu_book" | "find_in_page" | "headphones";

export type ProfileView = {
  name: string;
  level: number;
  school: string;
  title: string;
  /** Picture of the student's chosen character, full body. */
  image: string;
  coins: number;
  streakDays: number;
  xp: { label: string; current: number; next: number };
  gear: { id: string; name: string; icon: GearIcon; tone: "gold" | "violet" }[];
  cefr: string;
  skills: {
    id: string;
    name: string;
    detail: string;
    percent: number;
    icon: SkillIcon;
    tone: "primary" | "secondary" | "success" | "tertiary";
  }[];
  wardrobeNote: string;
  inventoryNote: string;
  group: { name: string; mentor: string };
  telegram: { username: string; id: number };
};
