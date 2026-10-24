import type { Locale } from "@/lib/i18n";
import type { OptionIcon, StoryNode } from "@/lib/story/types";
import { tr, type Text } from "./text";

// The demo campaign "Забытая академия" of the story screens (03 map, 04 quest details,
// 05 player, 06 puzzle, 07 journal). Gate 2 plays chapter II, clue by clue, with progress
// counted per solved clue; Gate 3 replaces this with versioned story graphs and runs,
// the second campaign (B1–B2) and the chapters still shown locked here.
// Answer keys: campaign-keys.ts.

type QuestionContent = {
  kind: "question";
  id: string;
  location: Text;
  image: string;
  /** The clue text the parchment shows: English, the lesson. */
  parchment: string;
  prompt: { lead: Text; task: Text };
  options: { id: string; label: string; gloss: Text; icon: OptionIcon }[];
  /** The parchment's line in the interface language, offered after a wrong answer. */
  translation: Text;
  /** The archivist's hint after a wrong answer: points the way without giving the answer. */
  hint: { topic: Text; text: Text };
  clue: string;
};

type PuzzleContent = {
  kind: "puzzle";
  id: string;
  location: Text;
  image: string;
  parchment: string;
  title: Text;
  task: Text;
  scroll: Text;
  altar: Text;
  tiles: string[];
  hint: Text;
  clue: string;
};

export type NodeContent = QuestionContent | PuzzleContent;

/** A piece of evidence for the journal: found when its node is solved. */
export type Clue = {
  id: string;
  title: Text;
  english: string;
  location: Text;
  image: string;
  description: Text;
  phrase: { text: string; glosses: { word: string; meaning: Text }[] };
  tags: Text[];
  /** The deduction the journal shows once this clue is the latest found. */
  deduction: Text;
  /** What the journal says about it while it is still locked. */
  teaser: Text;
  /** The journal's button once this is the latest clue found: where the story goes next. */
  onward: Text;
};

export type ChapterIcon = "menu_book" | "castle" | "forest" | "radar" | "nightlight";

export type Chapter = {
  id: string;
  label: Text;
  /** The label as the object of a sentence: "Требуется завершить Главу II". */
  labelAccusative: Text;
  title: Text;
  subtitle: Text;
  cefr: string;
  minutes: number;
  image: string;
  icon: ChapterIcon;
  /** The chapter that must be finished first. */
  requires: string | null;
  /** Shown on a locked chapter instead of "requires": e.g. a level. */
  gate?: Text;
  description: Text;
  skills: Text;
  mission: Text;
  words: string[];
  reward: { xp: number; coins: number };
  /** Empty: the chapter's story is written in Gate 3. */
  nodes: NodeContent[];
};

export const CAMPAIGN = {
  id: "forgotten-academy",
  title: { ru: "Забытая академия", en: "The Forgotten Academy" } as Text,
  quote: {
    text: {
      ru: "«Знание языка — единственный ключ, способный растворить даже древнейшие заклятия академии.»",
      en: "“Knowing a language is the only key that can undo even the academy's oldest spells.”",
    } as Text,
    source: { ru: "— Гримуар Софизма, Том II", en: "— The Grimoire of Sophism, Vol. II" } as Text,
  },
};

const NODE_XP = 50;
const MAX_ATTEMPTS = 2;

export const clues: Clue[] = [
  {
    id: "seal",
    title: { ru: "Запечатанное письмо", en: "The sealed letter" },
    english: "The Sealed Letter",
    location: { ru: "Библиотека теней • Стол архивариуса", en: "Library of Shadows • The archivist's desk" },
    image: "/images/sealed-letter.webp",
    description: {
      ru: "Письмо под сургучной печатью с совой и луной. Внутри одна строка: «Look for the room where the moon never shines».",
      en: "A letter under a wax seal with an owl and a moon. Inside, a single line: “Look for the room where the moon never shines”.",
    },
    phrase: {
      text: "Look for the room where the moon never shines.",
      glosses: [
        { word: "look for", meaning: { ru: "искать", en: "search for" } },
        { word: "never", meaning: { ru: "никогда", en: "not ever" } },
        { word: "shine", meaning: { ru: "светить", en: "give light" } },
      ],
    },
    tags: [
      { ru: "Материал: Пергамент", en: "Material: Parchment" },
      { ru: "Тип: Послание", en: "Type: Message" },
    ],
    deduction: {
      ru: "Печать принадлежит архивариусу: письмо написал хранитель библиотеки.",
      en: "The seal is the archivist's: the keeper of the library wrote the letter.",
    },
    teaser: { ru: "Лежит на столе архивариуса под стопкой книг", en: "Lies on the archivist's desk under a pile of books" },
    onward: { ru: "Искать в библиотеке", en: "Search the library" },
  },
  {
    id: "bronze-key",
    title: { ru: "Бронзовый ключ с руной", en: "Bronze key with a rune" },
    english: "The Runed Bronze Key",
    location: { ru: "Библиотека теней • Тайник в фолианте", en: "Library of Shadows • A hiding place in a folio" },
    image: "/images/shadow-library.webp",
    description: {
      ru: "Тяжелый старинный ключ из потускневшей бронзы с выгравированной руной Луны. Бородка ключа в точности соответствует замочной скважине кованых врат подземелья башни.",
      en: "A heavy old key of tarnished bronze, engraved with the rune of the Moon. Its bit fits exactly the keyhole of the iron gates of the tower's cellar.",
    },
    phrase: {
      text: "The key to unlock the cellar door.",
      glosses: [
        { word: "key", meaning: { ru: "ключ", en: "opens a lock" } },
        { word: "unlock", meaning: { ru: "отпирать", en: "open a lock" } },
        { word: "cellar", meaning: { ru: "подвал", en: "room under a house" } },
        { word: "door", meaning: { ru: "дверь", en: "way into a room" } },
      ],
    },
    tags: [
      { ru: "Материал: Древняя бронза", en: "Material: Ancient bronze" },
      { ru: "Тип: Магический ключ", en: "Type: Magic key" },
      { ru: "Цель: Подземелье башни", en: "Target: The tower's cellar" },
    ],
    deduction: {
      ru: "Запечатанное письмо указывает на «The cellar», где скрыта потайная дверь, отпираемая найденным бронзовым ключом.",
      en: "The sealed letter points to “The cellar”, where a hidden door waits for the bronze key you found.",
    },
    teaser: { ru: "Спрятан в одном из фолиантов библиотеки", en: "Hidden in one of the library's folios" },
    onward: { ru: "Перейти к подземелью", en: "Go to the cellar" },
  },
  {
    id: "manuscript",
    title: { ru: "Неизвестный манускрипт", en: "An unknown manuscript" },
    english: "The Unknown Manuscript",
    location: { ru: "Подземелье • Сундук архивариуса", en: "The cellar • The archivist's chest" },
    image: "/images/rune-chest.webp",
    description: {
      ru: "Свиток из сундука архивариуса. Чернила выцвели, но первая строка читается: «The door opens only at midnight».",
      en: "A scroll from the archivist's chest. The ink has faded, but the first line can be read: “The door opens only at midnight”.",
    },
    phrase: {
      text: "The door opens only at midnight.",
      glosses: [
        { word: "only", meaning: { ru: "только", en: "and at no other time" } },
        { word: "midnight", meaning: { ru: "полночь", en: "12 o'clock at night" } },
      ],
    },
    tags: [
      { ru: "Материал: Пергамент", en: "Material: Parchment" },
      { ru: "Тип: Рукопись", en: "Type: Manuscript" },
    ],
    deduction: {
      ru: "Дверь подземелья откроется лишь в полночь: время для следующего шага известно.",
      en: "The cellar door opens only at midnight: now you know when to go.",
    },
    teaser: { ru: "Скрыто в глубинах подземелья за тяжелыми кованными вратами", en: "Hidden deep in the cellar behind heavy iron gates" },
    onward: { ru: "Дождаться полуночи", en: "Wait for midnight" },
  },
  {
    id: "catacomb-map",
    title: { ru: "Тайная карта катакомб", en: "The secret catacomb map" },
    english: "The Secret Catacomb Map",
    location: { ru: "Подземелье • За потайной дверью", en: "The cellar • Behind the hidden door" },
    image: "/images/grand-library.webp",
    description: {
      ru: "Карта катакомб под башней. Стрелка ведёт на север, к залу с водой.",
      en: "A map of the catacombs under the tower. An arrow points north, to a hall with water.",
    },
    phrase: {
      text: "Go north and follow the sound of water.",
      glosses: [
        { word: "north", meaning: { ru: "север", en: "direction to the top of a map" } },
        { word: "follow", meaning: { ru: "идти за", en: "go after" } },
      ],
    },
    tags: [
      { ru: "Материал: Кожа", en: "Material: Leather" },
      { ru: "Тип: Карта", en: "Type: Map" },
    ],
    deduction: {
      ru: "Карта ведёт к подземному залу с водой на севере.",
      en: "The map leads to an underground hall with water in the north.",
    },
    teaser: { ru: "Требуется разгадать рунный замок на каменной двери", en: "The rune lock on a stone door must be solved first" },
    onward: { ru: "Спуститься в катакомбы", en: "Go down to the catacombs" },
  },
  {
    id: "moon-amulet",
    title: { ru: "Амулет лунной тени", en: "The moon-shadow amulet" },
    english: "The Moon-Shadow Amulet",
    location: { ru: "Катакомбы • Зал воды", en: "The catacombs • The hall of water" },
    image: "/images/glowing-chest.webp",
    description: {
      ru: "Амулет, который архивариус спрятал от тех, кто ищет власти. Тайна главы II раскрыта.",
      en: "The amulet the archivist hid from those who seek power. The mystery of chapter II is solved.",
    },
    phrase: {
      text: "The amulet was hidden to keep the academy safe.",
      glosses: [
        { word: "hidden", meaning: { ru: "спрятан", en: "put out of sight" } },
        { word: "safe", meaning: { ru: "в безопасности", en: "protected" } },
      ],
    },
    tags: [
      { ru: "Материал: Лунное серебро", en: "Material: Moon silver" },
      { ru: "Тип: Реликвия", en: "Type: Relic" },
    ],
    deduction: {
      ru: "Архивариус спрятал амулет, чтобы защитить академию. Дело закрыто.",
      en: "The archivist hid the amulet to protect the academy. Case closed.",
    },
    teaser: { ru: "Финальная разгадка тайны Главы II", en: "The final answer of chapter II" },
    onward: { ru: "Вернуться на карту", en: "Back to the map" },
  },
  {
    id: "prologue-tome",
    title: { ru: "Вводный фолиант", en: "The introductory folio" },
    english: "The Introductory Folio",
    location: { ru: "Библиотека теней", en: "Library of Shadows" },
    image: "/images/grand-library.webp",
    description: {
      ru: "Первый том библиотеки: правила академии и карта её башен.",
      en: "The library's first volume: the academy's rules and a map of its towers.",
    },
    phrase: {
      text: "Students must be quiet in the library.",
      glosses: [
        { word: "must", meaning: { ru: "должны", en: "have to" } },
        { word: "quiet", meaning: { ru: "тихий", en: "making little noise" } },
      ],
    },
    tags: [{ ru: "Тип: Книга", en: "Type: Book" }],
    deduction: {
      ru: "В библиотеке говорят шёпотом: здесь начинается путь ученика.",
      en: "In the library people whisper: this is where a student's journey begins.",
    },
    teaser: { ru: "Первая книга на полке", en: "The first book on the shelf" },
    onward: { ru: "Войти в академию", en: "Enter the academy" },
  },
];

export const clueById = new Map(clues.map((clue) => [clue.id, clue]));

const library: Text = { ru: "Библиотека теней", en: "Library of Shadows" };

export const chapters: Chapter[] = [
  {
    id: "prologue",
    label: { ru: "Пролог", en: "Prologue" },
    labelAccusative: { ru: "Пролог", en: "the Prologue" },
    title: { ru: "Шепот в библиотеке", en: "Whispers in the library" },
    subtitle: { ru: "Вводный лексикон и древние фолианты", en: "First words and ancient folios" },
    cefr: "A1",
    minutes: 5,
    image: "/images/grand-library.webp",
    icon: "menu_book",
    requires: null,
    description: {
      ru: "Первый вечер в академии. Найди в библиотеке вводный фолиант и узнай её главное правило.",
      en: "Your first evening at the academy. Find the introductory folio in the library and learn its first rule.",
    },
    skills: { ru: "Reading, Classroom words", en: "Reading, Classroom words" },
    mission: { ru: "1 улика, чтобы войти в академию.", en: "1 clue to enter the academy." },
    words: ["library", "quiet", "book"],
    reward: { xp: 50, coins: 10 },
    nodes: [
      {
        kind: "question",
        id: "prologue-1",
        location: library,
        image: "/images/grand-library.webp",
        parchment: "Students must be quiet in the library.",
        prompt: {
          lead: { ru: "На первой странице фолианта — правило академии.", en: "The first page of the folio holds the academy's rule." },
          task: { ru: "Прочитай его и выбери, что оно значит.", en: "Read it and choose what it means." },
        },
        options: [
          { id: "whisper", label: "Speak softly", gloss: { ru: "Говорить тихо", en: "Use a quiet voice" }, icon: "local_library" },
          { id: "eat", label: "Eat your dinner", gloss: { ru: "Съесть ужин", en: "Have a meal" }, icon: "restaurant" },
          { id: "sleep", label: "Go to sleep", gloss: { ru: "Лечь спать", en: "Go to bed" }, icon: "nightlight" },
        ],
        translation: {
          ru: "Ученики должны вести себя тихо в библиотеке.",
          en: "In the library, students have to make as little noise as they can.",
        },
        hint: {
          topic: { ru: "Лексика", en: "Vocabulary" },
          text: {
            ru: "Слово «quiet» значит «тихий». Что делают тихо?",
            en: "The word «quiet» means making little noise. What do you do quietly?",
          },
        },
        clue: "prologue-tome",
      },
    ],
  },
  {
    id: "tower",
    label: { ru: "Глава II", en: "Chapter II" },
    labelAccusative: { ru: "Главу II", en: "Chapter II" },
    title: { ru: "Тайна забытой башни", en: "The Secret of the Forgotten Tower" },
    subtitle: { ru: "Поиск улик в покоях", en: "Searching the chambers for clues" },
    cefr: "A2",
    minutes: 15,
    image: "/images/forgotten-tower.webp",
    icon: "castle",
    requires: "prologue",
    description: {
      ru: "В старинных архивах обнаружено запечатанное сургучом послание. Отправляйся в заброшенную обсерваторию цитадели, расшифруй тайные подсказки и выясни, кто скрывается в лунной тени.",
      en: "A message sealed with wax has been found in the old archives. Go to the citadel's abandoned observatory, decode the secret clues and find out who hides in the moon's shadow.",
    },
    skills: {
      ru: "Reading Comprehension, Detective Deduction, Past Simple tense.",
      en: "Reading Comprehension, Detective Deduction, Past Simple tense.",
    },
    mission: { ru: "5 ключевых улик для раскрытия тайны манускрипта.", en: "5 key clues to solve the mystery of the manuscript." },
    words: ["whisper", "cellar", "moonlight", "antique", "shadow"],
    reward: { xp: 150, coins: 40 },
    nodes: [
      {
        kind: "question",
        id: "tower-1",
        location: library,
        image: "/images/shadow-library.webp",
        parchment: "The seal shows an owl and a crescent moon.",
        prompt: {
          lead: { ru: "На столе архивариуса лежит письмо под печатью.", en: "A sealed letter lies on the archivist's desk." },
          task: { ru: "Чья это печать?", en: "Whose seal is it?" },
        },
        options: [
          {
            id: "archivist",
            label: "The archivist",
            gloss: { ru: "Хранитель библиотеки", en: "The keeper of the library" },
            icon: "local_library",
          },
          { id: "cook", label: "The cook", gloss: { ru: "Повар академии", en: "The academy's cook" }, icon: "restaurant" },
          { id: "guard", label: "The night guard", gloss: { ru: "Ночной стражник", en: "The guard of the night" }, icon: "nightlight" },
        ],
        translation: { ru: "На печати — сова и полумесяц.", en: "The seal has an owl and a crescent moon on it." },
        hint: {
          topic: { ru: "Чтение", en: "Reading" },
          text: {
            ru: "Сова — птица мудрости и книг. Кто в академии хранит книги?",
            en: "The owl is the bird of wisdom and books. Who keeps the books at the academy?",
          },
        },
        clue: "seal",
      },
      {
        kind: "question",
        id: "tower-2",
        location: library,
        image: "/images/shadow-library.webp",
        parchment: "Look for the room where the moon never shines.",
        prompt: {
          lead: { ru: "В библиотеке найдено запечатанное письмо.", en: "A sealed letter was found in the library." },
          task: { ru: "Прочитай его и найди верную подсказку.", en: "Read it and find the right clue." },
        },
        options: [
          {
            id: "cellar",
            label: "The cellar",
            gloss: { ru: "Подземелье без окон", en: "An underground room with no windows" },
            icon: "stairs",
          },
          { id: "garden", label: "The garden", gloss: { ru: "Сад академии", en: "The academy garden" }, icon: "park" },
          { id: "tower", label: "The tower", gloss: { ru: "Астрономический шпиль", en: "The astronomy spire" }, icon: "fort" },
        ],
        translation: { ru: "Ищите комнату, где никогда не светит луна.", en: "Find the room that moonlight never reaches." },
        hint: {
          topic: { ru: "Лексика", en: "Vocabulary" },
          text: {
            ru: "Обратите внимание на отрицательное наречие «never» (никогда). Подумайте, в каком именно помещении замка совершенно нет окон?",
            en: "Notice the negative adverb «never». Which room of the castle has no windows at all?",
          },
        },
        clue: "bronze-key",
      },
      {
        kind: "puzzle",
        id: "tower-3",
        location: { ru: "Подземелье башни", en: "The tower's cellar" },
        image: "/images/rune-chest.webp",
        parchment: "We found the key.",
        title: { ru: "Сундук архивариуса", en: "The archivist's chest" },
        task: {
          ru: "Восстанови заклинание: собери верный порядок слов, чтобы открыть древний сундук архива.",
          en: "Restore the spell: put the words in the right order to open the archive's ancient chest.",
        },
        scroll: { ru: "Зашифрованный свиток A2", en: "Ciphered scroll A2" },
        altar: { ru: "Алтарь Рун №4", en: "Rune altar no. 4" },
        tiles: ["found", "We", "key", "the"],
        hint: {
          ru: "Предложение в Past Simple начинается с того, кто действует: We… А ключ — это «the key».",
          en: "A Past Simple sentence starts with who does it: We… And the key is “the key”.",
        },
        clue: "manuscript",
      },
      {
        kind: "question",
        id: "tower-4",
        location: { ru: "Подземелье башни", en: "The tower's cellar" },
        image: "/images/rune-chest.webp",
        parchment: "The door opens only at midnight.",
        prompt: {
          lead: { ru: "В сундуке лежит манускрипт.", en: "A manuscript lies in the chest." },
          task: { ru: "Когда можно открыть дверь?", en: "When can you open the door?" },
        },
        options: [
          { id: "midnight", label: "At midnight", gloss: { ru: "В полночь", en: "At 12 o'clock at night" }, icon: "nightlight" },
          { id: "morning", label: "In the morning", gloss: { ru: "Утром", en: "Early in the day" }, icon: "park" },
          { id: "always", label: "At any time", gloss: { ru: "В любое время", en: "Whenever you like" }, icon: "door_front" },
        ],
        translation: { ru: "Дверь открывается только в полночь.", en: "The door opens at midnight and at no other time." },
        hint: {
          topic: { ru: "Грамматика", en: "Grammar" },
          text: {
            ru: "Слово «only» значит «только». Найдите время рядом с ним.",
            en: "The word «only» means and no other. Find the time next to it.",
          },
        },
        clue: "catacomb-map",
      },
      {
        kind: "question",
        id: "tower-5",
        location: { ru: "Катакомбы", en: "The catacombs" },
        image: "/images/grand-library.webp",
        parchment: "Go north and follow the sound of water.",
        prompt: {
          lead: { ru: "Карта катакомб ведёт дальше.", en: "The catacomb map leads on." },
          task: { ru: "Куда нужно идти?", en: "Where must you go?" },
        },
        options: [
          {
            id: "water",
            label: "To the hall of water",
            gloss: { ru: "К залу с водой", en: "Towards the sound of water" },
            icon: "water_drop",
          },
          { id: "crypt", label: "To the old crypt", gloss: { ru: "В старый склеп", en: "To the old grave room" }, icon: "skull" },
          { id: "stairs", label: "Back up the stairs", gloss: { ru: "Обратно по лестнице", en: "Back the way you came" }, icon: "stairs" },
        ],
        translation: { ru: "Идите на север, на звук воды.", en: "Go north, towards the sound of water." },
        hint: {
          topic: { ru: "Лексика", en: "Vocabulary" },
          text: { ru: "Follow — «идти за». За чем идти? За звуком…", en: "Follow means go after. Go after what? A sound of…" },
        },
        clue: "moon-amulet",
      },
    ],
  },
  {
    id: "forest",
    label: { ru: "Глава III", en: "Chapter III" },
    labelAccusative: { ru: "Главу III", en: "Chapter III" },
    title: { ru: "Шепчущий лес", en: "The Whispering Forest" },
    subtitle: { ru: "Прилагательные и диалоги с духами", en: "Adjectives and talks with spirits" },
    cefr: "A2",
    minutes: 15,
    image: "/images/forgotten-tower.webp",
    icon: "forest",
    requires: "tower",
    description: { ru: "", en: "" },
    skills: { ru: "", en: "" },
    mission: { ru: "", en: "" },
    words: [],
    reward: { xp: 150, coins: 40 },
    nodes: [],
  },
  {
    id: "echo",
    label: { ru: "Глава IV", en: "Chapter IV" },
    labelAccusative: { ru: "Главу IV", en: "Chapter IV" },
    title: { ru: "Башня Эха", en: "The Tower of Echoes" },
    subtitle: { ru: "Аудирование и тайны прошлого", en: "Listening and secrets of the past" },
    cefr: "B1",
    minutes: 20,
    image: "/images/forgotten-tower.webp",
    icon: "radar",
    requires: "forest",
    gate: { ru: "Уровень B1 • Сложные загадки", en: "Level B1 • Harder riddles" },
    description: { ru: "", en: "" },
    skills: { ru: "", en: "" },
    mission: { ru: "", en: "" },
    words: [],
    reward: { xp: 200, coins: 60 },
    nodes: [],
  },
  {
    id: "archives",
    label: { ru: "Финал саги", en: "Finale" },
    labelAccusative: { ru: "Финал саги", en: "the Finale" },
    title: { ru: "Архивы Архимага", en: "The Archmage's Archives" },
    subtitle: { ru: "Мастерское испытание всех правил", en: "A master test of every rule" },
    cefr: "B1",
    minutes: 25,
    image: "/images/forgotten-tower.webp",
    icon: "nightlight",
    requires: "echo",
    gate: { ru: "Финальный босс кампании", en: "The campaign's final boss" },
    description: { ru: "", en: "" },
    skills: { ru: "", en: "" },
    mission: { ru: "", en: "" },
    words: [],
    reward: { xp: 300, coins: 100 },
    nodes: [],
  },
];

export const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
export const nodeById = new Map(chapters.flatMap((chapter) => chapter.nodes.map((node) => [node.id, { chapter, node }] as const)));

/** A node as the story player shows it, in the interface language. */
export function storyNode(nodeId: string, locale: Locale): StoryNode | null {
  const found = nodeById.get(nodeId);
  if (!found) return null;
  const { chapter, node } = found;
  const index = chapter.nodes.indexOf(node) + 1;
  const clue = clueById.get(node.clue);
  const frame = {
    id: node.id,
    chapter: tr(chapter.label, locale),
    cefr: chapter.cefr,
    storyTitle: tr(chapter.title, locale),
    location: tr(node.location, locale),
    image: node.image,
    clue: { index, total: chapter.nodes.length, text: node.parchment, title: clue ? tr(clue.title, locale) : "" },
    maxAttempts: MAX_ATTEMPTS,
    reward: { xp: NODE_XP },
  };
  if (node.kind === "question") {
    return {
      ...frame,
      kind: "question",
      prompt: { lead: tr(node.prompt.lead, locale), task: tr(node.prompt.task, locale) },
      options: node.options.map((option) => ({ id: option.id, label: option.label, gloss: tr(option.gloss, locale), icon: option.icon })),
      translation: tr(node.translation, locale),
      hint: { topic: tr(node.hint.topic, locale), text: tr(node.hint.text, locale) },
    };
  }
  return {
    ...frame,
    kind: "puzzle",
    title: tr(node.title, locale),
    task: tr(node.task, locale),
    scroll: tr(node.scroll, locale),
    altar: tr(node.altar, locale),
    tiles: node.tiles,
    hint: tr(node.hint, locale),
  };
}

export const STORY_NODE_XP = NODE_XP;
