import type { Text } from "./text";

// The six free starting characters of 12_character_select, in the screen's order. Names and roles
// are the screen's; the descriptions of the five not shown selected there are written to match the
// cat's. The art is the plain base model of each (stitch-assets, see scripts/import-images.mjs).

export const CHARACTER_IDS = ["girl", "boy", "cat", "fox", "owl", "forest"] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

export type Character = {
  id: CharacterId;
  /** The hero's default name; the student may rename their hero. */
  name: Text;
  role: Text;
  species: Text;
  about: Text;
  /** The discipline the hero studies: "Уровень 7 • Магия", "Опыт ранга Магии". */
  school: Text;
  schoolXp: Text;
  image: string;
};

export const characters: Record<CharacterId, Character> = {
  girl: {
    id: "girl",
    name: { ru: "Алиса", en: "Alice" },
    role: { ru: "Странница", en: "Wanderer" },
    species: { ru: "Девочка", en: "Girl" },
    about: {
      ru: "Неутомимая путешественница: ни одна тропа академии не останется неисследованной.",
      en: "A tireless traveller: no path of the academy stays unexplored.",
    },
    school: { ru: "Следопытство", en: "Tracking" },
    schoolXp: { ru: "Опыт ранга Следопытов", en: "Tracker rank XP" },
    image: "/images/characters/girl.webp",
  },
  boy: {
    id: "boy",
    name: { ru: "Лео", en: "Leo" },
    role: { ru: "Ученик мага", en: "Mage apprentice" },
    species: { ru: "Мальчик", en: "Boy" },
    about: {
      ru: "Прилежный ученик, который мечтает однажды прочитать все книги архива.",
      en: "A diligent apprentice who dreams of reading every book in the archive.",
    },
    school: { ru: "Магия", en: "Magic" },
    schoolXp: { ru: "Опыт ранга Магии", en: "Magic rank XP" },
    image: "/images/characters/boy.webp",
  },
  cat: {
    id: "cat",
    name: { ru: "Барсик", en: "Barsik" },
    role: { ru: "Мистик", en: "Mystic" },
    species: { ru: "Серый кот", en: "Grey cat" },
    about: {
      ru: "Любознательный спутник, чуткий к магическим тайнам и древним манускриптам.",
      en: "A curious companion with a keen sense for magical secrets and ancient manuscripts.",
    },
    school: { ru: "Магия", en: "Magic" },
    schoolXp: { ru: "Опыт ранга Магии", en: "Magic rank XP" },
    image: "/images/characters/cat.webp",
  },
  fox: {
    id: "fox",
    name: { ru: "Рен", en: "Ren" },
    role: { ru: "Ловкач", en: "Trickster" },
    species: { ru: "Рыжий лис", en: "Red fox" },
    about: {
      ru: "Быстрый и находчивый: замечает улику раньше, чем её успевают спрятать.",
      en: "Quick and resourceful: spots a clue before anyone can hide it.",
    },
    school: { ru: "Ловкость", en: "Agility" },
    schoolXp: { ru: "Опыт ранга Ловкачей", en: "Trickster rank XP" },
    image: "/images/characters/fox.webp",
  },
  owl: {
    id: "owl",
    name: { ru: "Орион", en: "Orion" },
    role: { ru: "Книгочей", en: "Bookworm" },
    species: { ru: "Сова", en: "Owl" },
    about: {
      ru: "Знаток старинных свитков, читающий даже при лунном свете.",
      en: "An expert in old scrolls who reads even by moonlight.",
    },
    school: { ru: "Знание", en: "Lore" },
    schoolXp: { ru: "Опыт ранга Знания", en: "Lore rank XP" },
    image: "/images/characters/owl.webp",
  },
  forest: {
    id: "forest",
    name: { ru: "Финн", en: "Finn" },
    role: { ru: "Дух леса", en: "Forest spirit" },
    species: { ru: "Лесной дух", en: "Forest spirit" },
    about: {
      ru: "Тихий хранитель рощи, который понимает шёпот деревьев.",
      en: "A quiet keeper of the grove who understands the whisper of the trees.",
    },
    school: { ru: "Природа", en: "Nature" },
    schoolXp: { ru: "Опыт ранга Природы", en: "Nature rank XP" },
    image: "/images/characters/forest.webp",
  },
};

export const isCharacterId = (value: unknown): value is CharacterId =>
  typeof value === "string" && (CHARACTER_IDS as readonly string[]).includes(value);
