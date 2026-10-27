import type { Campaign, Clue, Grimoire, Scene } from "@/lib/story/graph";
import { withGlosses } from "@/lib/story/glosses";
import type { Text } from "../text";

// Campaign 1, "Забытая академия" (A1–A2): an investigation in three chapters. Chapter II branches
// on how careful the student is; chapter III ends in one of three endings, depending on what the
// student chose and found. Story text is English (the lesson), with a translation for each line.
// Answer keys: forgotten-academy-keys.ts.

const t = (ru: string, en: string): Text => ({ ru, en });
const library = t("Библиотека теней", "Library of Shadows");
const cellar = t("Подземелье башни", "The tower's cellar");
const catacombs = t("Катакомбы", "The catacombs");
const forest = t("Шепчущий лес", "The Whispering Forest");

const grimoire = (g: Grimoire) => g;

const clues: Clue[] = [
  {
    id: "prologue-tome",
    title: t("Вводный фолиант", "The introductory folio"),
    english: "The Introductory Folio",
    location: library,
    image: "/images/grand-library.webp",
    description: t(
      "Первый том библиотеки: правила академии и карта её башен.",
      "The library's first volume: the academy's rules and a map of its towers.",
    ),
    phrase: {
      text: "Students must be quiet in the library.",
      glosses: [
        { word: "must", meaning: t("должны", "have to") },
        { word: "quiet", meaning: t("тихий", "making little noise") },
      ],
    },
    tags: [t("Тип: Книга", "Type: Book")],
    deduction: t(
      "В библиотеке говорят шёпотом: здесь начинается путь ученика.",
      "In the library people whisper: this is where a student's journey begins.",
    ),
    teaser: t("Первая книга на полке", "The first book on the shelf"),
    onward: t("Войти в академию", "Enter the academy"),
  },
  {
    id: "seal",
    title: t("Запечатанное письмо", "The sealed letter"),
    english: "The Sealed Letter",
    location: t("Библиотека теней • Стол архивариуса", "Library of Shadows • The archivist's desk"),
    image: "/images/sealed-letter.webp",
    description: t(
      "Письмо под сургучной печатью с совой и луной. Внутри одна строка: «Look for the room where the moon never shines».",
      "A letter under a wax seal with an owl and a moon. Inside, a single line: “Look for the room where the moon never shines”.",
    ),
    phrase: {
      text: "Look for the room where the moon never shines.",
      glosses: [
        { word: "look for", meaning: t("искать", "search for") },
        { word: "never", meaning: t("никогда", "not ever") },
        { word: "shine", meaning: t("светить", "give light") },
      ],
    },
    tags: [t("Материал: Пергамент", "Material: Parchment"), t("Тип: Послание", "Type: Message")],
    deduction: t(
      "Печать принадлежит архивариусу: письмо написал хранитель библиотеки.",
      "The seal is the archivist's: the keeper of the library wrote the letter.",
    ),
    teaser: t("Лежит на столе архивариуса под стопкой книг", "Lies on the archivist's desk under a pile of books"),
    onward: t("Искать в библиотеке", "Search the library"),
  },
  {
    id: "bronze-key",
    title: t("Бронзовый ключ с руной", "Bronze key with a rune"),
    english: "The Runed Bronze Key",
    location: t("Библиотека теней • Тайник в фолианте", "Library of Shadows • A hiding place in a folio"),
    image: "/images/shadow-library.webp",
    description: t(
      "Тяжелый старинный ключ из потускневшей бронзы с выгравированной руной Луны. Бородка ключа в точности соответствует замочной скважине кованых врат подземелья башни.",
      "A heavy old key of tarnished bronze, engraved with the rune of the Moon. Its bit fits exactly the keyhole of the iron gates of the tower's cellar.",
    ),
    phrase: {
      text: "The key to unlock the cellar door.",
      glosses: [
        { word: "key", meaning: t("ключ", "opens a lock") },
        { word: "unlock", meaning: t("отпирать", "open a lock") },
        { word: "cellar", meaning: t("подвал", "room under a house") },
        { word: "door", meaning: t("дверь", "way into a room") },
      ],
    },
    tags: [
      t("Материал: Древняя бронза", "Material: Ancient bronze"),
      t("Тип: Магический ключ", "Type: Magic key"),
      t("Цель: Подземелье башни", "Target: The tower's cellar"),
    ],
    deduction: t(
      "Запечатанное письмо указывает на «The cellar», где скрыта потайная дверь, отпираемая найденным бронзовым ключом.",
      "The sealed letter points to “The cellar”, where a hidden door waits for the bronze key you found.",
    ),
    teaser: t("Спрятан в одном из фолиантов библиотеки", "Hidden in one of the library's folios"),
    onward: t("Перейти к подземелью", "Go to the cellar"),
  },
  {
    id: "owl-note",
    title: t("Приписка под печатью", "The note under the seal"),
    english: "The Note Under the Seal",
    location: t("Библиотека теней • Письмо", "Library of Shadows • The letter"),
    image: "/images/sealed-letter.webp",
    description: t(
      "Если перечитать письмо, под печатью видна крошечная приписка: «Trust the owl, not the crown».",
      "Read the letter again and a tiny line shows under the seal: “Trust the owl, not the crown”.",
    ),
    phrase: {
      text: "Trust the owl, not the crown.",
      glosses: [
        { word: "trust", meaning: t("доверять", "believe someone is honest") },
        { word: "crown", meaning: t("корона", "what a king wears") },
      ],
    },
    tags: [t("Тип: Тайная приписка", "Type: Hidden note")],
    deduction: t(
      "Сова — знак архивариуса. Письмо советует верить ей, а не тем, кто ищет власти.",
      "The owl is the archivist's sign. The letter says: trust her, not those who want power.",
    ),
    teaser: t("Видна только тому, кто читает внимательно", "Only a careful reader sees it"),
    onward: t("Спуститься в подземелье", "Go down to the cellar"),
  },
  {
    id: "manuscript",
    title: t("Неизвестный манускрипт", "An unknown manuscript"),
    english: "The Unknown Manuscript",
    location: t("Подземелье • Сундук архивариуса", "The cellar • The archivist's chest"),
    image: "/images/rune-chest.webp",
    description: t(
      "Свиток из сундука архивариуса. Чернила выцвели, но первая строка читается: «The door opens only at midnight».",
      "A scroll from the archivist's chest. The ink has faded, but the first line can be read: “The door opens only at midnight”.",
    ),
    phrase: {
      text: "The door opens only at midnight.",
      glosses: [
        { word: "only", meaning: t("только", "and at no other time") },
        { word: "midnight", meaning: t("полночь", "12 o'clock at night") },
      ],
    },
    tags: [t("Материал: Пергамент", "Material: Parchment"), t("Тип: Рукопись", "Type: Manuscript")],
    deduction: t(
      "Дверь подземелья откроется лишь в полночь: время для следующего шага известно.",
      "The cellar door opens only at midnight: now you know when to go.",
    ),
    teaser: t("Скрыто в глубинах подземелья за тяжелыми коваными вратами", "Hidden deep in the cellar behind heavy iron gates"),
    onward: t("Дождаться полуночи", "Wait for midnight"),
  },
  {
    id: "catacomb-map",
    title: t("Тайная карта катакомб", "The secret catacomb map"),
    english: "The Secret Catacomb Map",
    location: t("Подземелье • За потайной дверью", "The cellar • Behind the hidden door"),
    image: "/images/grand-library.webp",
    description: t(
      "Карта катакомб под башней. Стрелка ведёт на север, к залу с водой.",
      "A map of the catacombs under the tower. An arrow points north, to a hall with water.",
    ),
    phrase: {
      text: "Go north and follow the sound of water.",
      glosses: [
        { word: "north", meaning: t("север", "direction to the top of a map") },
        { word: "follow", meaning: t("идти за", "go after") },
      ],
    },
    tags: [t("Материал: Кожа", "Material: Leather"), t("Тип: Карта", "Type: Map")],
    deduction: t("Карта ведёт к подземному залу с водой на севере.", "The map leads to an underground hall with water in the north."),
    teaser: t("Требуется разгадать рунный замок на каменной двери", "The rune lock on a stone door must be solved first"),
    onward: t("Спуститься в катакомбы", "Go down to the catacombs"),
  },
  {
    id: "moon-amulet",
    title: t("Амулет лунной тени", "The moon-shadow amulet"),
    english: "The Moon-Shadow Amulet",
    location: t("Катакомбы • Зал воды", "The catacombs • The hall of water"),
    image: "/images/glowing-chest.webp",
    description: t(
      "Амулет, который архивариус спрятала от тех, кто ищет власти. Он светится, когда рядом лес.",
      "The amulet the archivist hid from those who seek power. It glows when the forest is near.",
    ),
    phrase: {
      text: "The amulet was hidden to keep the academy safe.",
      glosses: [
        { word: "hidden", meaning: t("спрятан", "put out of sight") },
        { word: "safe", meaning: t("в безопасности", "protected") },
      ],
    },
    tags: [t("Материал: Лунное серебро", "Material: Moon silver"), t("Тип: Реликвия", "Type: Relic")],
    deduction: t(
      "Архивариус спрятала амулет, чтобы защитить академию. Но чей он на самом деле?",
      "The archivist hid the amulet to protect the academy. But whose is it really?",
    ),
    teaser: t("Финальная разгадка тайны Главы II", "The final answer of chapter II"),
    onward: t("Идти в Шепчущий лес", "Go to the Whispering Forest"),
  },
  {
    id: "silver-leaf",
    title: t("Серебряный лист", "The silver leaf"),
    english: "The Silver Leaf",
    location: forest,
    image: "/images/forest.webp",
    description: t(
      "Лист, который дух леса оставил в твоей ладони после разгаданной загадки. На нём — тот же знак луны, что на амулете.",
      "A leaf the forest spirit left in your hand after its riddle. It bears the same moon sign as the amulet.",
    ),
    phrase: {
      text: "The oldest tree is wise and patient.",
      glosses: [
        { word: "wise", meaning: t("мудрый", "knowing a lot") },
        { word: "patient", meaning: t("терпеливый", "able to wait calmly") },
      ],
    },
    tags: [t("Материал: Лунное серебро", "Material: Moon silver"), t("Тип: Знак леса", "Type: Sign of the forest")],
    deduction: t(
      "Знак на листе и на амулете один и тот же: амулет родом из леса.",
      "The sign on the leaf and on the amulet is the same: the amulet comes from the forest.",
    ),
    teaser: t("Дух леса отдаёт его тому, кто разгадает загадку", "The spirit gives it to whoever solves its riddle"),
    onward: t("Ответить духу", "Answer the spirit"),
  },
];

const authored: Campaign = {
  id: "forgotten-academy",
  version: 1,
  title: t("Забытая академия", "The Forgotten Academy"),
  cefr: "A1–A2",
  requires: null,
  quote: {
    text: t(
      "«Знание языка — единственный ключ, способный растворить даже древнейшие заклятия академии.»",
      "“Knowing a language is the only key that can undo even the academy's oldest spells.”",
    ),
    source: t("— Гримуар Софизма, Том II", "— The Grimoire of Sophism, Vol. II"),
  },
  caseNumber: 12,
  clues,
  chapters: [
    {
      id: "prologue",
      label: t("Пролог", "Prologue"),
      labelAccusative: t("Пролог", "the Prologue"),
      title: t("Шепот в библиотеке", "Whispers in the library"),
      subtitle: t("Вводный лексикон и древние фолианты", "First words and ancient folios"),
      cefr: "A1",
      minutes: 5,
      image: "/images/grand-library.webp",
      icon: "menu_book",
      description: t(
        "Первый вечер в академии. Познакомься с архивариусом, найди в библиотеке вводный фолиант и узнай её главное правило.",
        "Your first evening at the academy. Meet the archivist, find the introductory folio in the library and learn its first rule.",
      ),
      skills: t("Reading, Greetings, Classroom words", "Reading, Greetings, Classroom words"),
      mission: t("1 улика, чтобы войти в академию.", "1 clue to enter the academy."),
      words: ["library", "quiet", "book", "welcome"],
      reward: { xp: 50, coins: 10 },
      scenes: [
        {
          kind: "narration",
          id: "p-arrive",
          location: t("Ворота академии", "The academy gates"),
          image: "/images/forgotten-tower.webp",
          text: "It is night. You open the big door of the Forgotten Academy. Inside, there are many old books.",
          translation: t(
            "Ночь. Ты открываешь большую дверь Забытой академии. Внутри много старых книг.",
            "It is night time. You open the academy's big door. There are lots of old books inside.",
          ),
        },
        {
          kind: "dialogue",
          id: "p-greet",
          location: library,
          image: "/images/grand-library.webp",
          lines: [
            {
              speaker: t("Архивариус Элеонора", "Eleanor, the archivist"),
              text: "Welcome, new student. I am Eleanor, the archivist.",
              translation: t(
                "Добро пожаловать, новый ученик. Я Элеонора, архивариус.",
                "Hello and welcome. My name is Eleanor, I look after the books.",
              ),
            },
            {
              speaker: t("Ты", "You"),
              text: "Hello! Nice to meet you.",
              translation: t("Здравствуйте! Приятно познакомиться.", "Hello! I am happy to meet you."),
            },
            {
              speaker: t("Архивариус Элеонора", "Eleanor, the archivist"),
              text: "Please read the first rule of the library.",
              translation: t("Пожалуйста, прочитай первое правило библиотеки.", "Please read the library's first rule."),
            },
          ],
        },
        {
          kind: "question",
          id: "prologue-1",
          location: library,
          image: "/images/grand-library.webp",
          parchment: "Students must be quiet in the library.",
          translation: t(
            "Ученики должны вести себя тихо в библиотеке.",
            "In the library, students have to make as little noise as they can.",
          ),
          prompt: {
            lead: t("На первой странице фолианта — правило академии.", "The first page of the folio holds the academy's rule."),
            task: t("Прочитай его и выбери, что оно значит.", "Read it and choose what it means."),
          },
          options: [
            { id: "whisper", label: "Speak softly", gloss: t("Говорить тихо", "Use a quiet voice"), icon: "local_library" },
            { id: "eat", label: "Eat your dinner", gloss: t("Съесть ужин", "Have a meal"), icon: "restaurant" },
            { id: "sleep", label: "Go to sleep", gloss: t("Лечь спать", "Go to bed"), icon: "nightlight" },
          ],
          maxAttempts: 2,
          xp: 50,
          hint: {
            topic: t("Лексика", "Vocabulary"),
            text: t(
              "Слово «quiet» значит «тихий». Что делают тихо?",
              "The word «quiet» means making little noise. What do you do quietly?",
            ),
          },
          grimoire: grimoire({
            title: t("Гримуар «Must»", "The grimoire of «Must»"),
            minutes: 2,
            rule: {
              heading: t("Правило с must:", "A rule with must:"),
              formula: "Subject + [MUST] + verb",
              text: t(
                "«Must» — «должен»: так говорят о правилах. После must глагол без «to».",
                "«Must» is for rules. The verb after it has no «to».",
              ),
            },
            deduction: t(
              "Правило требует тишины — значит, в библиотеке говорят тихо: Speak softly.",
              "The rule asks for quiet, so in the library you speak softly.",
            ),
            quiz: { sentence: "Students ___ be quiet in the library.", options: ["must", "eats", "quietly"] },
          }),
          clue: "prologue-tome",
        },
      ],
    },
    {
      id: "tower",
      label: t("Глава II", "Chapter II"),
      labelAccusative: t("Главу II", "Chapter II"),
      title: t("Тайна забытой башни", "The Secret of the Forgotten Tower"),
      subtitle: t("Поиск улик в покоях", "Searching the chambers for clues"),
      cefr: "A2",
      minutes: 15,
      image: "/images/forgotten-tower.webp",
      icon: "castle",
      description: t(
        "В старинных архивах обнаружено запечатанное сургучом послание. Отправляйся в заброшенную обсерваторию цитадели, расшифруй тайные подсказки и выясни, кто скрывается в лунной тени.",
        "A message sealed with wax has been found in the old archives. Go to the citadel's abandoned observatory, decode the secret clues and find out who hides in the moon's shadow.",
      ),
      skills: t(
        "Reading Comprehension, Detective Deduction, Past Simple tense.",
        "Reading Comprehension, Detective Deduction, Past Simple tense.",
      ),
      mission: t("5 ключевых улик для раскрытия тайны манускрипта.", "5 key clues to solve the mystery of the manuscript."),
      words: ["whisper", "cellar", "moonlight", "antique", "shadow"],
      reward: { xp: 150, coins: 40 },
      scenes: [
        {
          kind: "narration",
          id: "t-intro",
          location: library,
          image: "/images/shadow-library.webp",
          text: "The next evening, Eleanor is not in the library. On her desk there is a letter with a wax seal.",
          translation: t(
            "На следующий вечер Элеоноры нет в библиотеке. На её столе лежит письмо с сургучной печатью.",
            "The next evening Eleanor is gone. A letter closed with wax lies on her desk.",
          ),
        },
        {
          kind: "question",
          id: "tower-1",
          location: library,
          image: "/images/shadow-library.webp",
          parchment: "The seal shows an owl and a crescent moon.",
          translation: t("На печати — сова и полумесяц.", "The seal has an owl and a crescent moon on it."),
          prompt: {
            lead: t("На столе архивариуса лежит письмо под печатью.", "A sealed letter lies on the archivist's desk."),
            task: t("Чья это печать?", "Whose seal is it?"),
          },
          options: [
            {
              id: "archivist",
              label: "The archivist",
              gloss: t("Хранитель библиотеки", "The keeper of the library"),
              icon: "local_library",
            },
            { id: "cook", label: "The cook", gloss: t("Повар академии", "The academy's cook"), icon: "restaurant" },
            { id: "guard", label: "The night guard", gloss: t("Ночной стражник", "The guard of the night"), icon: "nightlight" },
          ],
          maxAttempts: 2,
          xp: 50,
          hint: {
            topic: t("Чтение", "Reading"),
            text: t(
              "Сова — птица мудрости и книг. Кто в академии хранит книги?",
              "The owl is the bird of wisdom and books. Who keeps the books at the academy?",
            ),
          },
          grimoire: grimoire({
            title: t("Гримуар «Чей?»", "The grimoire of «Whose?»"),
            minutes: 2,
            rule: {
              heading: t("Притяжательный 's:", "The possessive 's:"),
              formula: "the archivist + ['S] + seal",
              text: t(
                "Чтобы сказать «чей», к владельцу добавляют 's: the archivist's seal — печать архивариуса.",
                "To say whose, add 's to the owner: the archivist's seal.",
              ),
            },
            deduction: t(
              "Сова — знак книг и мудрости. Книги хранит архивариус — значит, и печать его.",
              "The owl is the sign of books and wisdom. The archivist keeps the books, so the seal is hers.",
            ),
            quiz: { sentence: "This is the ___ seal.", options: ["archivist's", "archivists", "archivist"] },
          }),
          clue: "seal",
        },
        {
          kind: "question",
          id: "tower-2",
          location: library,
          image: "/images/shadow-library.webp",
          parchment: "Look for the room where the moon never shines.",
          translation: t("Ищите комнату, где никогда не светит луна.", "Find the room that moonlight never reaches."),
          prompt: {
            lead: t("В библиотеке найдено запечатанное письмо.", "A sealed letter was found in the library."),
            task: t("Прочитай его и найди верную подсказку.", "Read it and find the right clue."),
          },
          options: [
            { id: "cellar", label: "The cellar", gloss: t("Подземелье без окон", "An underground room with no windows"), icon: "stairs" },
            { id: "garden", label: "The garden", gloss: t("Сад академии", "The academy garden"), icon: "park" },
            { id: "tower", label: "The tower", gloss: t("Астрономический шпиль", "The astronomy spire"), icon: "fort" },
          ],
          maxAttempts: 2,
          xp: 50,
          hint: {
            topic: t("Лексика", "Vocabulary"),
            text: t(
              "Обратите внимание на отрицательное наречие «never» (никогда). Подумайте, в каком именно помещении замка совершенно нет окон?",
              "Notice the negative adverb «never». Which room of the castle has no windows at all?",
            ),
          },
          grimoire: grimoire({
            title: t("Магия отрицаний: Гримуар «Never»", "The magic of negation: the grimoire of «Never»"),
            minutes: 2,
            rule: {
              heading: t("Позиция наречия частотности:", "Where the frequency adverb goes:"),
              formula: "Subject + [NEVER] + Verb (Present Simple)",
              text: t(
                "В английском языке «never» ставится перед смысловым глаголом и несёт полное отрицание.",
                "In English «never» goes before the main verb and means not at any time.",
              ),
            },
            deduction: t(
              "Если луна НИКОГДА не светит в этой комнате, значит в ней нет окон. Сад и башня открыты небу. Единственное темное место замка — подземелье (The cellar)!",
              "If the moon NEVER shines in the room, it has no windows. The garden and the tower are open to the sky. The only dark place in the castle is the cellar!",
            ),
            quiz: { sentence: "A vampire ___ walks in the daylight.", options: ["often", "never", "always"] },
          }),
          clue: "bronze-key",
        },
        {
          kind: "choice",
          id: "t-choice",
          location: library,
          image: "/images/shadow-library.webp",
          text: "The key is cold in your hand. The cellar is far below the tower, and the night is long.",
          translation: t(
            "Ключ холодит ладонь. Подземелье далеко под башней, а ночь длинная.",
            "The key feels cold. The cellar is deep under the tower, and there is a lot of night left.",
          ),
          prompt: t("Что ты сделаешь?", "What will you do?"),
          options: [
            {
              id: "now",
              label: "Go down to the cellar now",
              gloss: t("Спуститься в подвал сейчас", "Go to the cellar at once"),
              icon: "stairs",
              to: "tower-3",
              set: ["brave"],
            },
            {
              id: "reread",
              label: "Read the letter again first",
              gloss: t("Сначала перечитать письмо", "Look at the letter once more"),
              icon: "local_library",
              to: "t-reread",
              set: ["careful"],
            },
          ],
        },
        {
          kind: "narration",
          id: "t-reread",
          location: library,
          image: "/images/sealed-letter.webp",
          text: "You read the letter again. Under the seal, in very small letters: “Trust the owl, not the crown.”",
          translation: t(
            "Ты перечитываешь письмо. Под печатью совсем мелко: «Верь сове, а не короне».",
            "You read it once more. Under the seal, in tiny letters: “Believe the owl, not the crown.”",
          ),
          clue: "owl-note",
          next: "tower-3",
        },
        {
          kind: "puzzle",
          id: "tower-3",
          location: cellar,
          image: "/images/rune-chest.webp",
          parchment: "We found the key.",
          translation: t("Мы нашли ключ.", "We found the key."),
          title: t("Сундук архивариуса", "The archivist's chest"),
          task: t(
            "Восстанови заклинание: собери верный порядок слов, чтобы открыть древний сундук архива.",
            "Restore the spell: put the words in the right order to open the archive's ancient chest.",
          ),
          scroll: t("Зашифрованный свиток A2", "Ciphered scroll A2"),
          altar: t("Алтарь Рун №4", "Rune altar no. 4"),
          tiles: ["found", "We", "key", "the"],
          maxAttempts: 2,
          xp: 50,
          hint: {
            topic: t("Порядок слов", "Word order"),
            text: t(
              "Предложение в Past Simple начинается с того, кто действует: We… А ключ — это «the key».",
              "A Past Simple sentence starts with who does it: We… And the key is “the key”.",
            ),
          },
          grimoire: grimoire({
            title: t("Гримуар порядка слов", "The grimoire of word order"),
            minutes: 2,
            rule: {
              heading: t("Утверждение в Past Simple:", "A Past Simple sentence:"),
              formula: "Subject + Verb (past) + Object",
              text: t(
                "Сначала тот, кто действует, потом действие в прошедшем времени, потом предмет: We found the key.",
                "First who does it, then the action in the past, then the thing: We found the key.",
              ),
            },
            deduction: t(
              "Кто нашёл? Мы — We. Что сделали? Нашли — found. Что? Ключ — the key.",
              "Who? We. Did what? Found. What? The key.",
            ),
            quiz: { sentence: "We ___ the key yesterday.", options: ["find", "found", "finding"] },
          }),
          clue: "manuscript",
        },
        {
          kind: "question",
          id: "tower-4",
          location: cellar,
          image: "/images/rune-chest.webp",
          parchment: "The door opens only at midnight.",
          translation: t("Дверь открывается только в полночь.", "The door opens at midnight and at no other time."),
          prompt: {
            lead: t("В сундуке лежит манускрипт.", "A manuscript lies in the chest."),
            task: t("Когда можно открыть дверь?", "When can you open the door?"),
          },
          options: [
            { id: "midnight", label: "At midnight", gloss: t("В полночь", "At 12 o'clock at night"), icon: "nightlight" },
            { id: "morning", label: "In the morning", gloss: t("Утром", "Early in the day"), icon: "park" },
            { id: "always", label: "At any time", gloss: t("В любое время", "Whenever you like"), icon: "door_front" },
          ],
          maxAttempts: 2,
          xp: 50,
          hint: {
            topic: t("Грамматика", "Grammar"),
            text: t(
              "Слово «only» значит «только». Найдите время рядом с ним.",
              "The word «only» means and no other. Find the time next to it.",
            ),
          },
          grimoire: grimoire({
            title: t("Гримуар «Only»", "The grimoire of «Only»"),
            minutes: 2,
            rule: {
              heading: t("Only + время:", "Only + a time:"),
              formula: "[ONLY] + at midnight / on Sundays / in May",
              text: t(
                "«Only» сужает до одного варианта: только в это время и ни в какое другое.",
                "«Only» leaves a single choice: at that time and no other.",
              ),
            },
            deduction: t(
              "«Only at midnight» — значит не утром и не в любое время. Ответ: в полночь.",
              "“Only at midnight” means not in the morning and not at any time: at midnight.",
            ),
            quiz: { sentence: "The door opens ___ at midnight, never in the day.", options: ["only", "always", "often"] },
          }),
          clue: "catacomb-map",
        },
        {
          kind: "question",
          id: "tower-5",
          location: catacombs,
          image: "/images/grand-library.webp",
          parchment: "Go north and follow the sound of water.",
          translation: t("Идите на север, на звук воды.", "Go north, towards the sound of water."),
          prompt: {
            lead: t("Карта катакомб ведёт дальше.", "The catacomb map leads on."),
            task: t("Куда нужно идти?", "Where must you go?"),
          },
          options: [
            { id: "water", label: "To the hall of water", gloss: t("К залу с водой", "Towards the sound of water"), icon: "water_drop" },
            { id: "crypt", label: "To the old crypt", gloss: t("В старый склеп", "To the old grave room"), icon: "skull" },
            { id: "stairs", label: "Back up the stairs", gloss: t("Обратно по лестнице", "Back the way you came"), icon: "stairs" },
          ],
          maxAttempts: 2,
          xp: 50,
          hint: {
            topic: t("Лексика", "Vocabulary"),
            text: t("Follow — «идти за». За чем идти? За звуком…", "Follow means go after. Go after what? A sound of…"),
          },
          grimoire: grimoire({
            title: t("Гримуар направлений", "The grimoire of directions"),
            minutes: 2,
            rule: {
              heading: t("Глаголы движения:", "Verbs of moving:"),
              formula: "GO north • TURN left • [FOLLOW] the river",
              text: t(
                "«Follow» — идти следом за чем-то: за рекой, за звуком, за человеком.",
                "«Follow» means go after something: a river, a sound, a person.",
              ),
            },
            deduction: t(
              "Карта говорит идти за звуком воды — значит, к залу с водой.",
              "The map says follow the sound of water: to the hall of water.",
            ),
            quiz: { sentence: "Turn left and ___ the river.", options: ["follow", "forget", "sleep"] },
          }),
          clue: "moon-amulet",
        },
      ],
    },
    {
      id: "forest",
      label: t("Глава III", "Chapter III"),
      labelAccusative: t("Главу III", "Chapter III"),
      title: t("Шепчущий лес", "The Whispering Forest"),
      subtitle: t("Прилагательные и диалоги с духами", "Adjectives and talks with spirits"),
      cefr: "A2",
      minutes: 15,
      image: "/images/forest.webp",
      icon: "forest",
      description: t(
        "Амулет светится, когда рядом лес. Дух Шепчущего леса просит вернуть его. Кому он принадлежит — и кому ты поверишь?",
        "The amulet glows near the forest. The spirit of the Whispering Forest asks for it back. Whose is it — and whom will you trust?",
      ),
      skills: t("Adjectives, Polite answers, Using evidence", "Adjectives, Polite answers, Using evidence"),
      mission: t(
        "Разгадать загадку духа, доказать, кто написал письмо, и решить судьбу амулета.",
        "Solve the spirit's riddle, prove who wrote the letter, and decide the amulet's fate.",
      ),
      words: ["wise", "patient", "forest", "trust", "polite"],
      reward: { xp: 100, coins: 30 },
      scenes: [
        {
          kind: "narration",
          id: "f-path",
          location: forest,
          image: "/images/forest.webp",
          text: "The amulet glows in the dark. A narrow path leads into the Whispering Forest. The trees are tall and quiet.",
          translation: t(
            "Амулет светится в темноте. Узкая тропа ведёт в Шепчущий лес. Деревья высокие и тихие.",
            "The amulet gives light in the dark. A small path goes into the Whispering Forest. The trees are high and silent.",
          ),
        },
        {
          kind: "dialogue",
          id: "f-spirit",
          location: forest,
          image: "/images/forest-spirit.webp",
          lines: [
            {
              speaker: t("Дух леса", "The forest spirit"),
              text: "Stop, young one. That amulet belongs to the forest.",
              translation: t("Остановись, юный. Этот амулет принадлежит лесу.", "Wait, young one. That amulet is the forest's."),
            },
            {
              speaker: t("Ты", "You"),
              text: "I found it under the tower. Why is it yours?",
              translation: t("Я нашёл его под башней. Почему он твой?", "I found it below the tower. Why is it yours?"),
            },
            {
              speaker: t("Дух леса", "The forest spirit"),
              text: "Answer my riddle, and I will show you.",
              translation: t("Разгадай мою загадку — и я покажу.", "Solve my riddle and I will show you."),
            },
          ],
        },
        {
          kind: "question",
          id: "f-riddle",
          location: forest,
          image: "/images/forest-spirit.webp",
          parchment: "I am old and very wise. I sleep in winter and wake up in spring. What am I?",
          translation: t(
            "Я стар и очень мудр. Зимой я сплю, а весной просыпаюсь. Кто я?",
            "I am old and know a lot. I sleep in the cold months and wake up when it gets warm. What am I?",
          ),
          prompt: { lead: t("Дух леса загадывает загадку.", "The forest spirit asks a riddle."), task: t("Кто это?", "What is it?") },
          options: [
            { id: "tree", label: "An old tree", gloss: t("Старое дерево", "A tree of many years"), icon: "park" },
            { id: "river", label: "A river", gloss: t("Река", "Running water"), icon: "water_drop" },
            { id: "stone", label: "A stone", gloss: t("Камень", "A rock"), icon: "skull" },
          ],
          maxAttempts: 2,
          xp: 50,
          hint: {
            topic: t("Прилагательные", "Adjectives"),
            text: t(
              "Кто «спит» зимой без листьев и «просыпается» весной?",
              "What «sleeps» without leaves in winter and «wakes up» in spring?",
            ),
          },
          grimoire: grimoire({
            title: t("Гримуар прилагательных", "The grimoire of adjectives"),
            minutes: 2,
            rule: {
              heading: t("Прилагательное после be:", "An adjective after be:"),
              formula: "Subject + BE + (very) + adjective",
              text: t(
                "Прилагательное описывает: I am old, the tree is wise. «Very» усиливает: very wise.",
                "An adjective describes: I am old, the tree is wise. «Very» makes it stronger.",
              ),
            },
            deduction: t(
              "Река не спит зимой, камень не просыпается весной. Старое дерево — да.",
              "A river does not sleep in winter, a stone does not wake in spring. An old tree does.",
            ),
            quiz: { sentence: "The owl is very ___.", options: ["wise", "wisely", "wisdom"] },
          }),
          clue: "silver-leaf",
        },
        {
          kind: "evidence",
          id: "f-proof",
          location: forest,
          image: "/images/forest-spirit.webp",
          question: "“Who wrote the letter that sent you to the tower?” asks the spirit. “Show me.”",
          translation: t(
            "«Кто написал письмо, что привело тебя в башню? — спрашивает дух. — Покажи.»",
            "“Who wrote the letter that sent you to the tower?” the spirit asks. “Show me.”",
          ),
          prompt: t("Какая улика доказывает, кто написал письмо?", "Which clue proves who wrote the letter?"),
          clues: ["seal", "bronze-key", "manuscript", "moon-amulet"],
          maxAttempts: 2,
          xp: 50,
          hint: {
            topic: t("Дедукция", "Deduction"),
            text: t(
              "Письмо узнают по тому, чем его закрыли. Чей знак на нём?",
              "You know a letter by how it was closed. Whose sign is on it?",
            ),
          },
          grimoire: grimoire({
            title: t("Гримуар доказательств", "The grimoire of proof"),
            minutes: 2,
            rule: {
              heading: t("Глагол prove:", "The verb prove:"),
              formula: "The clue [PROVES] (that) + sentence",
              text: t(
                "«Prove» — доказывать. The seal proves that she wrote it — печать доказывает, что она его написала.",
                "«Prove» means show that something is true.",
              ),
            },
            deduction: t(
              "Печать с совой — знак архивариуса. Значит, письмо написала она.",
              "The owl seal is the archivist's sign, so she wrote the letter.",
            ),
            quiz: { sentence: "The seal ___ that she wrote the letter.", options: ["proves", "proofs", "proving"] },
          }),
        },
        {
          kind: "choice",
          id: "f-choice",
          location: forest,
          image: "/images/forest-spirit.webp",
          text: "The spirit holds out its hand. “Eleanor hid the amulet to keep it safe. Give it back, and the forest will sing again.”",
          translation: t(
            "Дух протягивает руку: «Элеонора спрятала амулет, чтобы сберечь его. Верни его — и лес снова запоёт».",
            "The spirit holds out a hand: “Eleanor hid the amulet to protect it. Give it back and the forest will sing again.”",
          ),
          prompt: t("Отдашь амулет?", "Will you give the amulet?"),
          options: [
            {
              id: "give",
              label: "Give the amulet to the spirit",
              gloss: t("Отдать амулет духу", "Hand it to the spirit"),
              icon: "park",
              to: "f-thanks",
              set: ["gave"],
            },
            {
              id: "keep",
              label: "Keep it for the academy",
              gloss: t("Оставить его академии", "Take it back to the academy"),
              icon: "castle",
              to: "f-keep",
              set: ["kept"],
            },
          ],
        },
        {
          kind: "question",
          id: "f-thanks",
          location: forest,
          image: "/images/forest-spirit.webp",
          parchment: "“Thank you, young one,” says the spirit.",
          translation: t("«Спасибо, юный», — говорит дух.", "“Thank you, young one,” the spirit says."),
          prompt: {
            lead: t("Дух благодарит тебя.", "The spirit thanks you."),
            task: t("Как ответить вежливо?", "What is the polite answer?"),
          },
          options: [
            {
              id: "welcome",
              label: "You're welcome.",
              gloss: t("Пожалуйста. / Не за что.", "A kind reply to thanks"),
              icon: "local_library",
            },
            { id: "giveback", label: "Give it back!", gloss: t("Верни его!", "An order"), icon: "skull" },
            { id: "dontcare", label: "I don't care.", gloss: t("Мне всё равно.", "A rude reply"), icon: "nightlight" },
          ],
          maxAttempts: 2,
          xp: 50,
          hint: {
            topic: t("Вежливость", "Politeness"),
            text: t("Что отвечают, когда тебя благодарят?", "What do you say when someone thanks you?"),
          },
          grimoire: grimoire({
            title: t("Гримуар вежливости", "The grimoire of politeness"),
            minutes: 1,
            rule: {
              heading: t("Ответ на благодарность:", "Answering thanks:"),
              formula: "Thank you! → [YOU'RE WELCOME].",
              text: t(
                "На «thank you» вежливо отвечают «you're welcome» — «пожалуйста».",
                "To «thank you» the polite reply is «you're welcome».",
              ),
            },
            deduction: t(
              "Дух благодарит — значит, вежливый ответ: You're welcome.",
              "The spirit thanks you, so the polite answer is “You're welcome.”",
            ),
            quiz: { sentence: "— Thank you for the book! — You're ___.", options: ["welcome", "sorry", "please"] },
          }),
          next: [
            { when: { all: [{ flag: "gave" }, { flag: "careful" }] }, to: "end-true" },
            { when: { all: [] }, to: "end-guardian" },
          ],
        },
        {
          kind: "dialogue",
          id: "f-keep",
          location: forest,
          image: "/images/forest.webp",
          lines: [
            {
              speaker: t("Дух леса", "The forest spirit"),
              text: "Then the forest will stay silent. But I will remember you.",
              translation: t(
                "Тогда лес останется безмолвным. Но я тебя запомню.",
                "Then the forest will stay quiet. But I will not forget you.",
              ),
            },
            {
              speaker: t("Ты", "You"),
              text: "I am sorry. The academy needs it.",
              translation: t("Прости. Он нужен академии.", "I am sorry. The academy needs it."),
            },
          ],
          next: "end-keeper",
        },
        {
          kind: "ending",
          id: "end-guardian",
          location: forest,
          image: "/images/forest.webp",
          title: t("Хранитель леса", "Guardian of the forest"),
          text: "The trees begin to sing. The forest thanks you, and the academy is safe.",
          translation: t(
            "Деревья начинают петь. Лес благодарит тебя, и академия в безопасности.",
            "The trees start to sing. The forest is grateful, and the academy is safe.",
          ),
          tone: "bright",
          reward: { xp: 200, coins: 50 },
        },
        {
          kind: "ending",
          id: "end-true",
          location: forest,
          image: "/images/forest.webp",
          title: t("Ученик архивариуса", "The archivist's apprentice"),
          text: "The spirit smiles: “You trusted the owl.” Eleanor steps out from the trees. She was the forest's friend all along, and now you are her apprentice.",
          translation: t(
            "Дух улыбается: «Ты поверил сове». Из-за деревьев выходит Элеонора. Она всегда была другом леса — и теперь ты её ученик.",
            "The spirit smiles: “You believed the owl.” Eleanor comes out of the trees. She was always the forest's friend, and now you learn from her.",
          ),
          tone: "secret",
          reward: { xp: 250, coins: 70 },
        },
        {
          kind: "ending",
          id: "end-keeper",
          location: t("Академия", "The academy"),
          image: "/images/forgotten-tower.webp",
          title: t("Хранитель амулета", "Keeper of the amulet"),
          text: "You walk back with the amulet. The academy is safe, but tonight the forest is silent.",
          translation: t(
            "Ты возвращаешься с амулетом. Академия в безопасности, но этой ночью лес молчит.",
            "You go back with the amulet. The academy is safe, but the forest makes no sound tonight.",
          ),
          tone: "bittersweet",
          reward: { xp: 150, coins: 40 },
        },
      ],
    },
  ],
};

// Word help on the English texts (lib/learning/gloss.ts), placed by the words it marks.
/** Version 1, as first published: runs begun on it keep playing it. */
export const forgottenAcademyV1 = withGlosses(authored, {
  "p-arrive": [
    { phrase: "Forgotten", ru: "забытая", definition: "not remembered any more", cefr: "A2" },
    { phrase: "Inside", ru: "внутри", cefr: "A1" },
  ],
  "p-greet": [
    {
      field: "line:0",
      phrase: "archivist",
      ru: "архивариус, хранитель архива",
      definition: "a person who looks after old books and papers",
      note: { ru: "Так зовут должность Элеоноры: она хранит книги академии.", en: "Eleanor's job: she looks after the academy's books." },
      cefr: "B1",
    },
  ],
  "prologue-1": [{ phrase: "quiet", ru: "тихий", definition: "making very little noise", example: "Please be quiet.", cefr: "A1" }],
  "tower-1": [
    { phrase: "seal", ru: "печать", definition: "a mark pressed into wax to close a letter", cefr: "B1" },
    { phrase: "crescent moon", ru: "полумесяц", example: "A crescent moon hung over the tower.", cefr: "B1" },
  ],
  "tower-2": [
    {
      phrase: "never shines",
      ru: "никогда не светит",
      note: { ru: "Never — «никогда»: в комнате нет лунного света.", en: "Never: the moon's light does not reach that room." },
      cefr: "A2",
    },
  ],
  "tower-4": [
    { phrase: "only", ru: "только", cefr: "A1" },
    { phrase: "midnight", ru: "полночь", example: "The clock strikes twelve at midnight.", cefr: "A2", answer: true },
  ],
});

/**
 * Version 2 (features gate E): on the forest path, a search in the picture (the rune stone with an R,
 * then the glowing mushrooms beside it; a glow sprite for finding both) and a talk with the forest
 * spirit, where the owl's note opens a line of its own. New runs play this version.
 */
export const forgottenAcademy: Campaign = (() => {
  const c = structuredClone(forgottenAcademyV1);
  c.version = 2;
  const chapter = c.chapters.find((ch) => ch.id === "forest")!;
  const search: Scene = {
    kind: "search",
    id: "f-search",
    location: forest,
    image: "/images/forest.webp",
    task: "Find the rune stone with the letter R, then the glowing mushrooms next to it.",
    translation: t(
      "Найди рунный камень с буквой R, а потом светящиеся грибы рядом с ним.",
      "Find the stone with an R on it, then the glowing mushrooms beside it.",
    ),
    picture: "/images/forest.webp",
    spots: [
      {
        id: "stone-r",
        label: "the stone with K, O, R",
        gloss: t("камень с рунами K, O, R", "the stone with K, O, R"),
        x: 0.19,
        y: 0.43,
        w: 0.08,
        h: 0.34,
        found: t("Руна R светится под пальцами.", "The R rune glows under your fingers."),
      },
      {
        id: "mushrooms",
        label: "the glowing mushrooms",
        gloss: t("светящиеся грибы", "the glowing mushrooms"),
        x: 0.255,
        y: 0.71,
        w: 0.07,
        h: 0.08,
        found: t("Грибы вспыхивают — из них вылетает светлячок!", "The mushrooms flare up — a glow sprite flies out!"),
      },
      {
        id: "stone-p",
        label: "the stone with P, O, P",
        gloss: t("камень с рунами P, O, P", "the stone with P, O, P"),
        x: 0.715,
        y: 0.47,
        w: 0.07,
        h: 0.3,
        found: t("", ""),
      },
      {
        id: "path",
        label: "the misty path",
        gloss: t("туманная тропа", "the misty path"),
        x: 0.43,
        y: 0.68,
        w: 0.14,
        h: 0.28,
        found: t("", ""),
      },
      { id: "ferns", label: "the ferns", gloss: t("папоротник", "the ferns"), x: 0.79, y: 0.73, w: 0.15, h: 0.2, found: t("", "") },
    ],
    hint: t("Буква R есть только на одном камне — на том, что слева.", "Only one stone has an R: the one on the left."),
    xp: 20,
    item: "sprite",
  };
  const talk: Scene = {
    kind: "talk",
    id: "f-ask",
    location: forest,
    image: "/images/forest-spirit.webp",
    character: { name: t("Дух леса", "The forest spirit"), image: "/images/forest-spirit.webp" },
    start: "why",
    lines: [
      {
        id: "why",
        text: "Before my riddle, tell me: why did you come to the forest?",
        translation: t("Прежде чем загадать загадку, скажи: зачем ты пришёл в лес?", "Before the riddle: why are you here?"),
        responses: [
          {
            id: "letter",
            text: "I want to know who wrote the letter.",
            gloss: t("Я хочу узнать, кто написал письмо.", "To learn who wrote the letter."),
            to: "letter",
          },
          { id: "lost", text: "I think I am lost.", gloss: t("Кажется, я заблудился.", "I do not know where I am."), to: "lost" },
        ],
      },
      {
        id: "letter",
        text: "Many people write letters. What did yours say?",
        translation: t("Письма пишут многие. Что было в твоём?", "Lots of people write letters. What was in yours?"),
        responses: [
          {
            id: "owl",
            text: "It said: trust the owl, not the crown.",
            gloss: t("Там было: верь сове, а не короне.", "Trust the owl, not the crown."),
            to: "owl",
            when: { clue: "owl-note" },
            set: ["owl-trust"],
          },
          { id: "forgot", text: "I don't remember, sorry.", gloss: t("Не помню, простите.", "I forgot."), to: "end" },
        ],
      },
      {
        id: "owl",
        text: "Then you are wiser than the king's men. Listen well to my riddle.",
        translation: t(
          "Значит, ты мудрее людей короля. Слушай мою загадку внимательно.",
          "You are wiser than the king's men. Listen well.",
        ),
        responses: [{ id: "ready", text: "Thank you. I am ready.", gloss: t("Спасибо. Я готов.", "I am ready."), to: "end" }],
      },
      {
        id: "lost",
        text: "Nobody is lost in my forest. Follow the path, and answer my riddle.",
        translation: t(
          "В моём лесу никто не теряется. Иди по тропе и отвечай на загадку.",
          "No one is lost here. Follow the path and answer.",
        ),
        responses: [{ id: "ok", text: "All right. Ask me.", gloss: t("Хорошо. Спрашивай.", "Go on."), to: "end" }],
      },
    ],
    xp: 15,
  };
  const at = (id: string) => chapter.scenes.findIndex((x) => x.id === id);
  chapter.scenes.splice(at("f-spirit"), 0, search);
  chapter.scenes.splice(at("f-riddle"), 0, talk);
  return c;
})();
