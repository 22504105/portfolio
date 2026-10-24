import { CHARACTER_IDS, type CharacterId } from "./characters";
import type { Text } from "./text";

// The cosmetic catalogue: the 12 accessories, 6 outfits and 6 companions of the standalone
// exports. Names follow the wardrobe, shop and inventory screens where they name an item.
// Items are cosmetic only: no item changes XP, grading or anything else in learning
// (the brief; the screens' "+15% опыта" lines are not implemented, see design-screen-map.md).
// Pictures are cards. Drawing an item on the hero needs its own alpha layers fitted per species
// (lib/content/figure.ts, rig.json): Gate 4 has them for the cat's witch hat, ceremonial cape and
// star amulet; every other item is NEEDS_ART_ASSET (docs/ASSET_AUDIT.md) and is not drawn.

export const SLOTS = ["headwear", "face", "neck", "outerwear", "outfit", "back", "handheld", "companion"] as const;
export type Slot = (typeof SLOTS)[number];

export type Rarity = "common" | "rare" | "epic";

export type Item = {
  id: string;
  slot: Slot;
  name: Text;
  note: Text;
  rarity: Rarity;
  /** Price in coins; 0 = not sold (starter or reward only). */
  price: number;
  /** The level from which the item can be bought or worn. */
  level: number;
  image: string;
  /** The heroes who may wear it. */
  species: readonly CharacterId[];
  /** Slots it cannot be worn with: wearing it takes off what is there. */
  conflicts: readonly Slot[];
  /** Its layered art (lib/content/layers.json), where there is any. */
  art?: string;
};

// Art cut for the Gate 4 slice: catalogue item -> layer set.
const ART: Record<string, string> = { "wizard-hat": "witch-hat", "sunset-cloak": "ceremonial-cape", "star-amulet": "star-amulet" };
// The ceremonial cape's back part covers the back, so nothing is carried there with it.
const CONFLICTS: Record<string, Slot[]> = { "sunset-cloak": ["back"] };

const item = (id: string, slot: Slot, rarity: Rarity, price: number, name: Text, note: Text, level = 1): Item => ({
  id,
  slot,
  name,
  note,
  rarity,
  price,
  level,
  image: `/images/items/${id}.webp`,
  // No item's art rules out a hero yet; the check is the server's either way.
  species: CHARACTER_IDS,
  conflicts: CONFLICTS[id] ?? [],
  art: ART[id],
});

export const items: Item[] = [
  item(
    "wizard-hat",
    "headwear",
    "epic",
    0,
    { ru: "Шляпа волшебника", en: "Wizard's hat" },
    { ru: "Остроконечная со звездой", en: "Pointed, with a star" },
  ),
  item(
    "forest-hood",
    "headwear",
    "common",
    120,
    { ru: "Лесной капюшон", en: "Forest hood" },
    { ru: "Ткань следопытов с листом", en: "Tracker's cloth with a leaf" },
  ),
  item(
    "star-crown",
    "headwear",
    "epic",
    400,
    { ru: "Венец звёзд", en: "Crown of stars" },
    { ru: "Золото и звёздный камень", en: "Gold and a star stone" },
    8,
  ),
  item(
    "round-glasses",
    "face",
    "common",
    90,
    { ru: "Круглые очки", en: "Round glasses" },
    { ru: "Металлическая оправа", en: "Metal frame" },
  ),
  item(
    "star-amulet",
    "neck",
    "rare",
    150,
    { ru: "Звёздный амулет", en: "Star amulet" },
    { ru: "Золотая звезда на цепочке", en: "A gold star on a chain" },
  ),
  item(
    "moon-pendant",
    "neck",
    "rare",
    180,
    { ru: "Амулет полумесяца", en: "Crescent amulet" },
    { ru: "Лунный камень в оправе", en: "A moonstone in a setting" },
  ),
  item("red-bow", "neck", "common", 60, { ru: "Красный бант", en: "Red bow" }, { ru: "Бархатная лента", en: "Velvet ribbon" }),
  item(
    "satchel",
    "back",
    "common",
    80,
    { ru: "Сумка искателя", en: "Seeker's satchel" },
    { ru: "Кожа и латунная пряжка", en: "Leather with a brass buckle" },
  ),
  item(
    "spellbook",
    "handheld",
    "epic",
    300,
    { ru: "Гримуар тайных рун", en: "Grimoire of secret runes" },
    { ru: "Древний том в рунах", en: "An ancient tome covered in runes" },
  ),
  item(
    "wand",
    "handheld",
    "common",
    0,
    { ru: "Волшебная палочка", en: "Magic wand" },
    { ru: "Первая палочка ученика", en: "An apprentice's first wand" },
  ),
  item(
    "lantern",
    "handheld",
    "rare",
    140,
    { ru: "Фонарь архивариуса", en: "Archivist's lantern" },
    { ru: "Светит в любом подземелье", en: "Shines in any dungeon" },
  ),
  item(
    "crystal-staff",
    "handheld",
    "rare",
    220,
    { ru: "Хрустальный посох", en: "Crystal staff" },
    { ru: "Посох с аметистом", en: "A staff topped with amethyst" },
  ),
  item(
    "violet-robe",
    "outfit",
    "rare",
    160,
    { ru: "Фиолетовая ряса", en: "Violet robe" },
    { ru: "Ряса младшего мага", en: "A junior mage's robe" },
  ),
  item(
    "violet-tunic",
    "outfit",
    "common",
    0,
    { ru: "Туника академии", en: "Academy tunic" },
    { ru: "Форма первокурсника", en: "First-year uniform" },
  ),
  item(
    "green-cape",
    "outerwear",
    "rare",
    200,
    { ru: "Плащ странника", en: "Wanderer's cape" },
    { ru: "С походной сумкой", en: "With a travelling pouch" },
  ),
  item(
    "sunset-cloak",
    "outerwear",
    "rare",
    250,
    { ru: "Мантия заката", en: "Sunset cloak" },
    { ru: "Церемониальная, алая с золотом", en: "Ceremonial, crimson and gold" },
  ),
  item("brown-coat", "outerwear", "common", 110, { ru: "Сюртук сыщика", en: "Detective's coat" }, { ru: "Тёплое сукно", en: "Warm wool" }),
  item(
    "midnight-cloak",
    "outerwear",
    "epic",
    0,
    { ru: "Полуночный плащ", en: "Midnight cloak" },
    { ru: "Награда недельного сундука", en: "A weekly chest reward" },
  ),
  item(
    "raven",
    "companion",
    "rare",
    260,
    { ru: "Ворон-вестник", en: "Messenger raven" },
    { ru: "Питомец-помощник", en: "A helper pet" },
    3,
  ),
  item("moon-cat", "companion", "epic", 380, { ru: "Лунный кот", en: "Moon cat" }, { ru: "Питомец-помощник", en: "A helper pet" }, 6),
  item("sprite", "companion", "rare", 240, { ru: "Светлячок-дух", en: "Glow sprite" }, { ru: "Питомец-помощник", en: "A helper pet" }, 2),
  item("fox-cub", "companion", "common", 180, { ru: "Лисёнок", en: "Fox cub" }, { ru: "Питомец-помощник", en: "A helper pet" }),
  item(
    "owlet",
    "companion",
    "rare",
    280,
    { ru: "Совёнок-спутник", en: "Owlet companion" },
    { ru: "Питомец-помощник", en: "A helper pet" },
    8,
  ),
  item(
    "ghost",
    "companion",
    "epic",
    420,
    { ru: "Призрак с фонарём", en: "Lantern ghost" },
    { ru: "Питомец-помощник", en: "A helper pet" },
    10,
  ),
];

export const itemById = new Map(items.map((entry) => [entry.id, entry]));

/** Given to every student when they choose their hero. */
export const STARTER_ITEMS = ["wizard-hat", "wand", "violet-tunic"] as const;

/**
 * What the weekly chest may give: one of these cloaks and glasses not owned yet, drawn at random
 * when it opens, and not shown beforehand (owner's decision 2026-10-24, as the approved rewards
 * screen has it); coins once all are owned.
 */
export const CHEST_ITEMS = ["midnight-cloak", "green-cape", "sunset-cloak", "brown-coat", "round-glasses"] as const;
export const CHEST_COINS = 60;

export const RARITY_LABEL: Record<Rarity, Text> = {
  common: { ru: "Обычный", en: "Common" },
  rare: { ru: "Редкий", en: "Rare" },
  epic: { ru: "Эпический", en: "Epic" },
};

/** Groups of slots as the wardrobe and shop tabs show them. */
export const SLOT_GROUPS: { id: string; label: Text; slots: Slot[] }[] = [
  { id: "head", label: { ru: "Голова", en: "Head" }, slots: ["headwear"] },
  { id: "cloaks", label: { ru: "Мантии", en: "Cloaks" }, slots: ["outerwear", "outfit"] },
  { id: "glasses", label: { ru: "Очки", en: "Glasses" }, slots: ["face"] },
  { id: "amulets", label: { ru: "Амулеты", en: "Amulets" }, slots: ["neck"] },
  { id: "hands", label: { ru: "В руках", en: "In hand" }, slots: ["handheld", "back"] },
  { id: "companions", label: { ru: "Спутники", en: "Companions" }, slots: ["companion"] },
];

export const SLOT_LABEL: Record<Slot, Text> = {
  headwear: { ru: "Голова", en: "Head" },
  face: { ru: "Очки", en: "Glasses" },
  neck: { ru: "Амулет", en: "Amulet" },
  outerwear: { ru: "Мантия", en: "Cloak" },
  outfit: { ru: "Одежда", en: "Clothes" },
  back: { ru: "Сумка", en: "Bag" },
  handheld: { ru: "Посох", en: "Staff" },
  companion: { ru: "Спутник", en: "Companion" },
};
