import { characters } from "@/lib/content/characters";
import { campaigns } from "@/lib/content/campaigns";
import { itemById, SLOTS, type Slot } from "@/lib/content/items";
import { tr } from "@/lib/content/text";
import type { Facts } from "@/lib/game/facts";
import { balance, currentChapter, currentStreak, levelOf, rankOf, skillProgress } from "@/lib/game/stats";
import { plural, type Dictionary, type Locale } from "@/lib/i18n";

// What the Profile screen shows (11_profile_2), worked out from the student's facts. Like
// HomeView: the screen renders this and nothing else, for the demo and the signed-in student.

/** Icons chosen by data; scripts/build-icons.mjs reads these unions to put them in the icon font. */
export type GearIcon = "magic_button" | "palette" | "auto_fix_high" | "diamond" | "eyeglasses" | "backpack" | "pets" | "checkroom";
export type SkillIcon = "translate" | "menu_book" | "find_in_page" | "headphones";

const GEAR_ICON: Record<Slot, GearIcon> = {
  headwear: "magic_button",
  outerwear: "palette",
  handheld: "auto_fix_high",
  neck: "diamond",
  face: "eyeglasses",
  back: "backpack",
  companion: "pets",
  outfit: "checkroom",
};

/** Who the student is outside the game: their Telegram account and their group, when they have them. */
export type Account = {
  telegram: { username: string | null; id: number } | null;
  group: { name: string; mentor: string } | null;
};

export type ProfileView = {
  name: string;
  level: number;
  school: string;
  title: string;
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
  account: Account;
};

export function profileView(facts: Facts, locale: Locale, t: Dictionary, account: Account, today: string): ProfileView {
  const character = characters[facts.profile.characterId ?? "cat"];
  const { level, into, next } = levelOf(balance(facts, "xp"));
  const worn = SLOTS.filter((slot) => slot !== "outfit" && facts.equipped[slot]).map((slot) => ({
    slot,
    item: itemById.get(facts.equipped[slot]!)!,
  }));
  const words = facts.saved.filter((s) => s.kind === "word").length;
  const vocabulary = skillProgress(facts, "vocabulary");
  const grammar = skillProgress(facts, "grammar");
  const reading = skillProgress(facts, "reading");
  const listening = skillProgress(facts, "listening");
  const chapter = currentChapter(facts)?.chapter ?? campaigns.at(-1)!.chapters.at(-1)!;
  return {
    name: facts.profile.heroName ?? tr(character.name, locale),
    level,
    school: tr(character.school, locale),
    title: tr(rankOf(level), locale),
    image: character.image,
    coins: balance(facts, "coins"),
    streakDays: currentStreak(facts, today),
    xp: { label: tr(character.schoolXp, locale), current: into, next },
    gear: worn.slice(0, 3).map(({ slot, item }) => ({
      id: item.id,
      name: tr(item.name, locale),
      icon: GEAR_ICON[slot],
      tone: slot === "outerwear" ? "violet" : "gold",
    })),
    cefr: chapter.cefr,
    skills: [
      {
        id: "vocabulary",
        name: t.profile.skills.vocabulary,
        detail: plural(locale, words, t.profile.skills.words),
        percent: vocabulary.percent,
        icon: "translate",
        tone: "primary",
      },
      {
        id: "grammar",
        name: t.profile.skills.grammar,
        detail: "Past Simple, Questions",
        percent: grammar.percent,
        icon: "menu_book",
        tone: "secondary",
      },
      {
        id: "reading",
        name: t.profile.skills.reading,
        detail: plural(locale, reading.correct, t.profile.skills.manuscripts),
        percent: reading.percent,
        icon: "find_in_page",
        tone: "success",
      },
      {
        id: "listening",
        name: t.profile.skills.listening,
        detail: plural(locale, listening.answered, t.profile.skills.dialogues),
        percent: listening.percent,
        icon: "headphones",
        tone: "tertiary",
      },
    ],
    wardrobeNote: worn.length ? worn.map(({ item }) => tr(item.name, locale)).join(", ") : t.wardrobe.nothing,
    inventoryNote: plural(locale, facts.inventory.length, t.profile.itemCount),
    account,
  };
}
