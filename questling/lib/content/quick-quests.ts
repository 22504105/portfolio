import type { Question } from "@/lib/learning/questions";
import type { Text } from "./text";

// Quick quests (08_quick_quests): short activities of three questions. The first three are the
// screen's own cards; the rest fill the daily rotation. Answer keys are in quick-quest-keys.ts,
// which the signed-in student's page never loads.

export type Skill = "vocabulary" | "grammar" | "reading" | "listening" | "cipher";

export type QuickQuest = {
  id: string;
  title: Text;
  topic: Text;
  skill: Skill;
  minutes: number;
  cefr: string;
  xp: number;
  coins: number;
  image: string;
  tone: "gold" | "violet";
  /** "daily": in the daily rotation; "assigned": only when a teacher assigns it (demo: assigned by the demo mentor). */
  audience: "daily" | "assigned";
  /** A line of the quest shown on its card (the listening quest's quote). */
  teaser?: string;
  questions: Question[];
};

export const quickQuests: QuickQuest[] = [
  {
    id: "letter",
    title: { ru: "Разгадай письмо", en: "Decipher the letter" },
    topic: { ru: "Словарный запас", en: "Vocabulary" },
    skill: "vocabulary",
    minutes: 5,
    cefr: "A2",
    xp: 50,
    coins: 15,
    image: "/images/sealed-letter.webp",
    tone: "gold",
    audience: "daily",
    questions: [
      {
        kind: "choice",
        id: "seal",
        prompt: {
          ru: "Письмо закрыто красной печатью. Как это сказать по-английски?",
          en: "The letter is closed with a red seal. How do you say it?",
        },
        options: [
          { id: "sealed", text: "The letter is sealed." },
          { id: "signed", text: "The letter is signed." },
          { id: "folded", text: "The letter is folded." },
        ],
      },
      {
        kind: "fill",
        id: "candle",
        prompt: { ru: "Вставь пропущенное слово.", en: "Fill in the missing word." },
        sentence: "She read the letter by the light of a ___.",
        bank: ["candle", "window", "river"],
      },
      {
        kind: "match",
        id: "words",
        prompt: { ru: "Соедини слова с переводом.", en: "Match each word with its meaning." },
        left: ["letter", "seal", "secret"],
        right: ["тайна", "письмо", "печать"],
      },
    ],
  },
  {
    id: "mist",
    title: { ru: "Слова из тумана", en: "Words from the mist" },
    topic: { ru: "Past Simple & Вопросы", en: "Past Simple & Questions" },
    skill: "grammar",
    minutes: 7,
    cefr: "A2",
    xp: 30,
    coins: 10,
    image: "/images/rune-spellbook.webp",
    tone: "violet",
    audience: "daily",
    questions: [
      {
        kind: "fill",
        id: "went",
        prompt: { ru: "Выбери форму Past Simple.", en: "Choose the Past Simple form." },
        sentence: "Yesterday the archivist ___ to the tower.",
        bank: ["goes", "went", "going"],
      },
      {
        kind: "order",
        id: "question",
        prompt: { ru: "Собери вопрос из слов.", en: "Put the words in order to make a question." },
        tiles: ["the", "Did", "key", "find", "you"],
      },
      {
        kind: "choice",
        id: "saw",
        prompt: { ru: "Какое предложение верно?", en: "Which sentence is correct?" },
        options: [
          { id: "a", text: "We see a ghost last night." },
          { id: "b", text: "We saw a ghost last night." },
          { id: "c", text: "We seen a ghost last night." },
        ],
      },
    ],
  },
  {
    id: "raven",
    title: { ru: "Пойми шёпот теней", en: "Understand the shadows' whisper" },
    topic: { ru: "Аудирование и улики", en: "Listening and clues" },
    skill: "listening",
    minutes: 4,
    cefr: "A2",
    xp: 40,
    coins: 15,
    image: "/images/crystal-casket.webp",
    tone: "violet",
    audience: "assigned",
    teaser: "Listen closely to the raven at the crossroads…",
    questions: [
      {
        kind: "choice",
        id: "where",
        prompt: { ru: "Послушай ворона. Где он ждёт?", en: "Listen to the raven. Where is it waiting?" },
        audio: "The raven is waiting at the old crossroads, near the broken bridge.",
        options: [
          { id: "bridge", text: "Near the broken bridge" },
          { id: "tower", text: "On top of the tower" },
          { id: "lake", text: "By the frozen lake" },
        ],
      },
      {
        kind: "choice",
        id: "when",
        prompt: { ru: "Послушай. Когда откроются ворота?", en: "Listen. When will the gates open?" },
        audio: "The gates will open at midnight, when the bell rings twelve times.",
        options: [
          { id: "dawn", text: "At dawn" },
          { id: "midnight", text: "At midnight" },
          { id: "noon", text: "At noon" },
        ],
      },
      {
        kind: "multi",
        id: "bring",
        prompt: { ru: "Послушай и отметь всё, что нужно взять с собой.", en: "Listen and mark everything you must bring." },
        options: [
          { id: "lantern", text: "a lantern" },
          { id: "map", text: "a map" },
          { id: "sword", text: "a sword" },
          { id: "key", text: "a key" },
        ],
      },
    ],
  },
  {
    id: "stars",
    title: { ru: "Карта созвездий", en: "The star chart" },
    topic: { ru: "Предлоги места", en: "Prepositions of place" },
    skill: "grammar",
    minutes: 5,
    cefr: "A2",
    xp: 35,
    coins: 10,
    image: "/images/rune-spellbook.webp",
    tone: "violet",
    audience: "daily",
    questions: [
      {
        kind: "fill",
        id: "under",
        prompt: { ru: "Ключ лежит под столом.", en: "The key is lying under the table." },
        sentence: "The key is ___ the table.",
        bank: ["under", "between", "behind"],
      },
      {
        kind: "choice",
        id: "between",
        prompt: { ru: "Как сказать «между двумя башнями»?", en: "How do you say it: the moon hangs in the middle of two towers?" },
        options: [
          { id: "between", text: "between the two towers" },
          { id: "among", text: "next the two towers" },
          { id: "over", text: "in the two towers" },
        ],
      },
      {
        kind: "order",
        id: "sentence",
        prompt: { ru: "Собери предложение.", en: "Put the words in order." },
        tiles: ["map", "is", "The", "on", "wall", "the"],
      },
    ],
  },
  {
    id: "runes",
    title: { ru: "Перепутанные руны", en: "Tangled runes" },
    topic: { ru: "Шифры и порядок слов", en: "Ciphers and word order" },
    skill: "cipher",
    minutes: 6,
    cefr: "A2",
    xp: 45,
    coins: 15,
    image: "/images/sealed-letter.webp",
    tone: "gold",
    audience: "daily",
    questions: [
      {
        kind: "order",
        id: "door",
        prompt: { ru: "Расшифруй надпись на двери.", en: "Decipher the words on the door." },
        tiles: ["door", "Open", "the", "slowly"],
      },
      {
        kind: "order",
        id: "owl",
        prompt: { ru: "Расшифруй записку совы.", en: "Decipher the owl's note." },
        tiles: ["at", "owl", "night", "The", "flies"],
      },
      {
        kind: "match",
        id: "opposites",
        prompt: { ru: "Соедини противоположности.", en: "Match the opposites." },
        left: ["dark", "open", "old"],
        right: ["new", "light", "closed"],
      },
    ],
  },
  {
    id: "bells",
    title: { ru: "Голоса колокольни", en: "Voices of the bell tower" },
    topic: { ru: "Аудирование", en: "Listening" },
    skill: "listening",
    minutes: 4,
    cefr: "A2",
    xp: 35,
    coins: 10,
    image: "/images/crystal-casket.webp",
    tone: "violet",
    audience: "daily",
    questions: [
      {
        kind: "choice",
        id: "who",
        prompt: { ru: "Послушай. Кто звонит в колокол?", en: "Listen. Who rings the bell?" },
        audio: "Every evening the old librarian climbs the stairs and rings the bell.",
        options: [
          { id: "librarian", text: "The old librarian" },
          { id: "student", text: "A young student" },
          { id: "guard", text: "The night guard" },
        ],
      },
      {
        kind: "fill",
        id: "stairs",
        prompt: { ru: "Послушай ещё раз и вставь слово.", en: "Listen again and fill in the word." },
        sentence: "The librarian climbs the ___.",
        bank: ["stairs", "tree", "wall"],
      },
      {
        kind: "choice",
        id: "often",
        prompt: { ru: "Как часто звонит колокол?", en: "How often does the bell ring?" },
        audio: "Every evening the old librarian climbs the stairs and rings the bell.",
        options: [
          { id: "evening", text: "Every evening" },
          { id: "morning", text: "Every morning" },
          { id: "week", text: "Once a week" },
        ],
      },
    ],
  },
  {
    id: "scroll",
    title: { ru: "Свиток библиотекаря", en: "The librarian's scroll" },
    topic: { ru: "Чтение", en: "Reading" },
    skill: "reading",
    minutes: 6,
    cefr: "A2",
    xp: 40,
    coins: 15,
    image: "/images/sealed-letter.webp",
    tone: "gold",
    audience: "daily",
    questions: [
      {
        kind: "choice",
        id: "why",
        prompt: { ru: "Прочитай записку. Почему библиотека закрыта?", en: "Read the note. Why is the library closed?" },
        passage:
          "The library is closed today because the roof is broken. It will open again on Monday. Please return your books to the box by the door.",
        options: [
          { id: "roof", text: "The roof is broken." },
          { id: "holiday", text: "It is a holiday." },
          { id: "books", text: "There are no books." },
        ],
      },
      {
        kind: "choice",
        id: "when",
        prompt: { ru: "Когда библиотека снова откроется?", en: "When will the library open again?" },
        passage:
          "The library is closed today because the roof is broken. It will open again on Monday. Please return your books to the box by the door.",
        options: [
          { id: "monday", text: "On Monday" },
          { id: "tomorrow", text: "Tomorrow" },
          { id: "never", text: "Never" },
        ],
      },
      {
        kind: "fill",
        id: "box",
        prompt: { ru: "Куда вернуть книги?", en: "Where should books be returned?" },
        sentence: "Return your books to the ___ by the door.",
        bank: ["box", "roof", "shelf"],
      },
    ],
  },
];

export const quickQuestById = new Map(quickQuests.map((quest) => [quest.id, quest]));

/** Daily quests on one day, and the bonus for finishing all of them. */
export const DAILY_QUEST_COUNT = 3;
export const DAILY_BONUS = { xp: 60, coins: 20 };
