import type { Text } from "./text";

// Daily Discovery (09_daily_discovery): a word and a fact for each day, prewritten. The day's
// entry is chosen by the calendar (lib/game/time.ts), in rotation. Facts carry a source line for
// editorial checking: a real, findable publication where the fact can be verified (Gate 5 replaced
// made-up ones; the brief forbids fabricated citations). "Архив №" is only the entry's number. Quiz answer keys are in daily-keys.ts.

export type DailyEntry = {
  id: string;
  word: {
    text: string;
    ipa: string;
    partOfSpeech: Text;
    translation: Text;
    example: string;
    exampleTranslation: Text;
    cefr: string;
  };
  quiz: { phrase: string; options: { id: string; text: Text }[]; xp: number };
  fact: { text: Text; source: string; archive: number };
};

export const DAILY_CLAIM_XP = 25;

export const dailyEntries: DailyEntry[] = [
  {
    id: "whisper",
    word: {
      text: "whisper",
      ipa: "/ˈwɪs.pər/",
      partOfSpeech: { ru: "verb, noun", en: "verb, noun" },
      translation: { ru: "шептать / шёпот", en: "to speak very softly; a very soft voice" },
      example: "The ancient walls whisper forgotten secrets.",
      exampleTranslation: { ru: "Древние стены шепчут забытые тайны.", en: "Old walls seem to softly tell secrets nobody remembers." },
      cefr: "A2",
    },
    quiz: {
      phrase: "She whispered the code",
      options: [
        { id: "a", text: { ru: "Она прокричала код", en: "She shouted the code" } },
        { id: "b", text: { ru: "Она прошептала шифр", en: "She said the code very softly" } },
        { id: "c", text: { ru: "Она записала ключ", en: "She wrote down the key" } },
      ],
      xp: 15,
    },
    fact: {
      text: {
        ru: "Знаете ли вы? У осьминогов три сердца, а их кровь имеет голубой цвет из-за меди.",
        en: "Did you know? Octopuses have three hearts, and their blood is blue because of copper.",
      },
      source: "Smithsonian Ocean, «Octopuses»",
      archive: 412,
    },
  },
  {
    id: "lantern",
    word: {
      text: "lantern",
      ipa: "/ˈlæn.tən/",
      partOfSpeech: { ru: "noun", en: "noun" },
      translation: { ru: "фонарь", en: "a lamp in a case, carried by a handle" },
      example: "The guard raised his lantern in the dark corridor.",
      exampleTranslation: { ru: "Стражник поднял фонарь в тёмном коридоре.", en: "The guard lifted his lamp in the dark passage." },
      cefr: "A2",
    },
    quiz: {
      phrase: "Bring a lantern to the cellar",
      options: [
        { id: "a", text: { ru: "Принеси фонарь в подвал", en: "Take a lamp down to the cellar" } },
        { id: "b", text: { ru: "Закрой фонарь в подвале", en: "Lock the lamp in the cellar" } },
        { id: "c", text: { ru: "Найди ключ от подвала", en: "Find the cellar key" } },
      ],
      xp: 15,
    },
    fact: {
      text: {
        ru: "Знаете ли вы? Мёд почти не портится: съедобный мёд находили в гробницах Древнего Египта.",
        en: "Did you know? Honey hardly ever spoils: edible honey has been found in ancient Egyptian tombs.",
      },
      source: "Smithsonian Magazine, «The Science Behind Honey’s Eternal Shelf Life», 2013",
      archive: 418,
    },
  },
  {
    id: "clue",
    word: {
      text: "clue",
      ipa: "/kluː/",
      partOfSpeech: { ru: "noun", en: "noun" },
      translation: { ru: "улика, подсказка", en: "a sign that helps you solve a mystery" },
      example: "The detective found a clue under the carpet.",
      exampleTranslation: { ru: "Сыщик нашёл улику под ковром.", en: "The detective found a helpful sign under the carpet." },
      cefr: "A2",
    },
    quiz: {
      phrase: "We have no clue",
      options: [
        { id: "a", text: { ru: "У нас нет ни одной зацепки", en: "We have nothing to help us solve it" } },
        { id: "b", text: { ru: "У нас нет ключа", en: "We have no key" } },
        { id: "c", text: { ru: "Нам не нужна помощь", en: "We need no help" } },
      ],
      xp: 15,
    },
    fact: {
      text: {
        ru: "Знаете ли вы? Сова может повернуть голову примерно на 270 градусов.",
        en: "Did you know? An owl can turn its head about 270 degrees.",
      },
      source: "Johns Hopkins Medicine; de Kok-Mercado et al., Science, 2013",
      archive: 425,
    },
  },
  {
    id: "brave",
    word: {
      text: "brave",
      ipa: "/breɪv/",
      partOfSpeech: { ru: "adjective", en: "adjective" },
      translation: { ru: "храбрый", en: "ready to do something frightening" },
      example: "Only a brave student enters the tower at night.",
      exampleTranslation: {
        ru: "Только храбрый ученик входит в башню ночью.",
        en: "Only a student without fear goes into the tower at night.",
      },
      cefr: "A2",
    },
    quiz: {
      phrase: "Be brave, little fox",
      options: [
        { id: "a", text: { ru: "Будь храбрым, лисёнок", en: "Don't be afraid, little fox" } },
        { id: "b", text: { ru: "Будь тихим, лисёнок", en: "Be quiet, little fox" } },
        { id: "c", text: { ru: "Беги быстрее, лисёнок", en: "Run faster, little fox" } },
      ],
      xp: 15,
    },
    fact: {
      text: {
        ru: "Знаете ли вы? Молния примерно в пять раз горячее поверхности Солнца.",
        en: "Did you know? A bolt of lightning is about five times hotter than the surface of the Sun.",
      },
      source: "NOAA National Weather Service, «Lightning science»",
      archive: 431,
    },
  },
  {
    id: "ancient",
    word: {
      text: "ancient",
      ipa: "/ˈeɪn.ʃənt/",
      partOfSpeech: { ru: "adjective", en: "adjective" },
      translation: { ru: "древний", en: "very, very old" },
      example: "The ancient map shows a hidden door.",
      exampleTranslation: { ru: "Древняя карта показывает скрытую дверь.", en: "The very old map shows a secret door." },
      cefr: "A2",
    },
    quiz: {
      phrase: "an ancient spell",
      options: [
        { id: "a", text: { ru: "новое правило", en: "a new rule" } },
        { id: "b", text: { ru: "громкий крик", en: "a loud shout" } },
        { id: "c", text: { ru: "древнее заклинание", en: "a very old magic spell" } },
      ],
      xp: 15,
    },
    fact: {
      text: {
        ru: "Знаете ли вы? Самой старой из сохранившихся датированных печатных книг больше тысячи лет.",
        en: "Did you know? The oldest surviving dated printed book is more than a thousand years old.",
      },
      source: "British Library, «The Diamond Sutra» (868 г.)",
      archive: 437,
    },
  },
  {
    id: "hidden",
    word: {
      text: "hidden",
      ipa: "/ˈhɪd.ən/",
      partOfSpeech: { ru: "adjective", en: "adjective" },
      translation: { ru: "спрятанный, скрытый", en: "put where nobody can see it" },
      example: "There is a hidden room behind the bookshelf.",
      exampleTranslation: { ru: "За книжной полкой есть потайная комната.", en: "Behind the bookshelf is a room nobody can see." },
      cefr: "A2",
    },
    quiz: {
      phrase: "a hidden message",
      options: [
        { id: "a", text: { ru: "длинное письмо", en: "a long letter" } },
        { id: "b", text: { ru: "скрытое послание", en: "a message that is kept out of sight" } },
        { id: "c", text: { ru: "пустой конверт", en: "an empty envelope" } },
      ],
      xp: 15,
    },
    fact: {
      text: {
        ru: "Знаете ли вы? Пчёлы общаются танцем: он показывает, где искать цветы.",
        en: "Did you know? Bees talk by dancing: the dance shows where to find flowers.",
      },
      source: "K. von Frisch, Нобелевская премия 1973 г. (танец пчёл)",
      archive: 442,
    },
  },
  {
    id: "journey",
    word: {
      text: "journey",
      ipa: "/ˈdʒɜː.ni/",
      partOfSpeech: { ru: "noun", en: "noun" },
      translation: { ru: "путешествие", en: "a long trip from one place to another" },
      example: "Our journey to the forgotten tower begins tonight.",
      exampleTranslation: {
        ru: "Наше путешествие к забытой башне начинается сегодня ночью.",
        en: "Our trip to the forgotten tower starts tonight.",
      },
      cefr: "A2",
    },
    quiz: {
      phrase: "Have a safe journey",
      options: [
        { id: "a", text: { ru: "Счастливого пути", en: "Travel safely" } },
        { id: "b", text: { ru: "Оставайся дома", en: "Stay at home" } },
        { id: "c", text: { ru: "Спокойной ночи", en: "Good night" } },
      ],
      xp: 15,
    },
    fact: {
      text: {
        ru: "Знаете ли вы? Свет от Солнца идёт до Земли около восьми минут.",
        en: "Did you know? Light from the Sun takes about eight minutes to reach the Earth.",
      },
      source: "NASA Space Place, «How long does it take sunlight to reach Earth?»",
      archive: 449,
    },
  },
];

export const dailyEntryById = new Map(dailyEntries.map((entry) => [entry.id, entry]));
