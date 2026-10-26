import type { Campaign, Clue } from "@/lib/story/graph";
import { withGlosses } from "@/lib/story/glosses";
import type { Text } from "../text";

// Campaign 2, "Башня Эха" (B1–B2): a mystery in two chapters, opened once "Забытая академия" is
// finished. Chapter IV branches on whether the student questions the guard or climbs alone;
// the finale ends in one of three endings, the secret one only for a student who did both:
// pressed the guard for the truth and gave the thief a chance. Keys: echo-tower-keys.ts.

const t = (ru: string, en: string): Text => ({ ru, en });
const tower = t("Башня Эха", "The Tower of Echoes");
const stairs = t("Башня Эха • Лестница", "The Tower of Echoes • The stairs");
const archives = t("Архивы Архимага", "The Archmage's Archives");

const clues: Clue[] = [
  {
    id: "closed-windows",
    title: t("Закрытые окна", "The closed windows"),
    english: "The Closed Windows",
    location: tower,
    image: "/images/forgotten-tower.webp",
    description: t(
      "Все окна башни заперты изнутри, и пыль на подоконниках не тронута. Ветер не мог раскачать колокол.",
      "Every window of the tower is locked from inside, and the dust on the sills is untouched. No wind could have moved the bell.",
    ),
    phrase: {
      text: "The bell can only ring if someone pulls the rope.",
      glosses: [
        { word: "can only", meaning: t("может только", "is able to, in no other way") },
        { word: "pull", meaning: t("тянуть", "move towards you") },
        { word: "rope", meaning: t("верёвка", "a thick string") },
      ],
    },
    tags: [t("Тип: Наблюдение", "Type: Observation"), t("Место: Башня Эха", "Place: Tower of Echoes")],
    deduction: t("Ветер ни при чём: колокол раскачал человек.", "It was not the wind: a person rang the bell."),
    teaser: t("Нужно осмотреть окна башни", "The tower's windows must be checked"),
    onward: t("Изучить колокол", "Study the bell"),
  },
  {
    id: "old-bell",
    title: t("Летопись колокола", "The bell's chronicle"),
    english: "The Bell's Chronicle",
    location: tower,
    image: "/images/rune-chest.webp",
    description: t(
      "Надпись на медной табличке у колокола: последний раз он звонил сто лет назад, в ночь, когда башню запечатали.",
      "A brass plate beside the bell: it last rang a hundred years ago, the night the tower was sealed.",
    ),
    phrase: {
      text: "The bell has not rung for a hundred years.",
      glosses: [
        { word: "has not rung", meaning: t("не звонил (до сих пор)", "has stayed silent until now") },
        { word: "for", meaning: t("в течение", "during a length of time") },
      ],
    },
    tags: [t("Материал: Медь", "Material: Brass"), t("Тип: Надпись", "Type: Inscription")],
    deduction: t(
      "Звон этой ночью — первый за сто лет. Кто-то знал, как открыть башню.",
      "Tonight's ringing is the first in a hundred years. Someone knew how to open the tower.",
    ),
    teaser: t("Табличка у самого колокола", "A plate right beside the bell"),
    onward: t("Решить, что делать дальше", "Decide what to do next"),
  },
  {
    id: "guard-confession",
    title: t("Признание стражника", "The guard's confession"),
    english: "The Guard's Confession",
    location: t("Башня Эха • У двери", "The Tower of Echoes • By the door"),
    image: "/images/forgotten-tower.webp",
    description: t(
      "Стражник признаётся: он уснул на час, а когда проснулся, дверь башни была открыта.",
      "The guard admits it: he fell asleep for an hour, and when he woke up the tower door was open.",
    ),
    phrase: {
      text: "When I woke up, the door had been opened.",
      glosses: [
        { word: "woke up", meaning: t("проснулся", "stopped sleeping") },
        { word: "had been opened", meaning: t("уже была открыта", "was opened before that") },
      ],
    },
    tags: [t("Тип: Показания", "Type: Testimony"), t("Свидетель: Ночной стражник", "Witness: The night guard")],
    deduction: t("Пока стражник спал, кто-то вошёл в башню.", "While the guard slept, someone went into the tower."),
    teaser: t("Стражник знает больше, чем говорит", "The guard knows more than he says"),
    onward: t("Подняться в башню", "Go up the tower"),
  },
  {
    id: "dusty-footprints",
    title: t("Следы на лестнице", "Footprints on the stairs"),
    english: "Footprints on the Stairs",
    location: stairs,
    image: "/images/shadow-library.webp",
    description: t(
      "На пыльных ступенях — маленькие следы. Они ведут вверх, но ни один не ведёт обратно вниз.",
      "Small footprints on the dusty steps. They lead up, but none of them come back down.",
    ),
    phrase: {
      text: "Someone had climbed the stairs before the bell rang.",
      glosses: [
        { word: "had climbed", meaning: t("поднялся (раньше)", "went up earlier") },
        { word: "before", meaning: t("до того как", "earlier than") },
      ],
    },
    tags: [t("Тип: Следы", "Type: Tracks"), t("Место: Лестница башни", "Place: Tower stairs")],
    deduction: t("Кто-то поднялся наверх до звона — и не спускался.", "Someone went up before the bell rang — and never came down."),
    teaser: t("Пыль на ступенях хранит секреты", "The dust on the steps keeps secrets"),
    onward: t("Подняться наверх", "Go upstairs"),
  },
  {
    id: "ink-stain",
    title: t("Фиолетовое пятно", "The violet stain"),
    english: "The Violet Ink Stain",
    location: archives,
    image: "/images/archive-mage.webp",
    description: t(
      "Свежее пятно фиолетовых чернил на пустой полке. Такими чернилами пишут только архивариусы академии.",
      "A fresh stain of violet ink on the empty shelf. Only the academy's archivists write with this ink.",
    ),
    phrase: {
      text: "If the guard had stayed awake, the thief would not have entered.",
      glosses: [
        { word: "had stayed", meaning: t("остался бы (в прошлом)", "an unreal past") },
        { word: "would not have entered", meaning: t("не вошёл бы", "did not happen, but could have") },
      ],
    },
    tags: [t("Материал: Чернила архивариусов", "Material: Archivists' ink"), t("Тип: Пятно", "Type: Stain")],
    deduction: t(
      "Вор пишет чернилами архивариусов — он хорошо знает архив.",
      "The thief writes with archivists' ink — someone who knows the archive well.",
    ),
    teaser: t("Что-то осталось на пустой полке", "Something was left on the empty shelf"),
    onward: t("Разгадать шифр архива", "Solve the archive's cipher"),
  },
  {
    id: "torn-page",
    title: t("Вырванная страница", "The torn page"),
    english: "The Torn Page",
    location: archives,
    image: "/images/sealed-letter.webp",
    description: t(
      "Страница, вырванная из пропавшей книги: заклинание, которым запечатали Башню Эха.",
      "A page torn from the missing book: the spell that sealed the Tower of Echoes.",
    ),
    phrase: {
      text: "Whoever reads the book controls the archive.",
      glosses: [
        { word: "whoever", meaning: t("тот, кто", "any person who") },
        { word: "control", meaning: t("управлять", "have power over") },
      ],
    },
    tags: [t("Тип: Заклинание", "Type: Spell"), t("Источник: Пропавшая книга", "From: The missing book")],
    deduction: t(
      "Вор искал заклинание башни: ему нужна была не книга, а её тайна.",
      "The thief wanted the tower's spell: not the book, but its secret.",
    ),
    teaser: t("Спрятана за свитками шифра", "Hidden behind the cipher scrolls"),
    onward: t("Найти вора", "Find the thief"),
  },
];

const authored: Campaign = {
  id: "echo-tower",
  version: 1,
  title: t("Башня Эха", "The Tower of Echoes"),
  cefr: "B1–B2",
  requires: "forgotten-academy",
  gate: t("Уровень B1 • Сложные загадки", "Level B1 • Harder riddles"),
  quote: {
    text: t(
      "«Эхо помнит всё, что было сказано, — но лишь тот, кто слушает, узнаёт правду.»",
      "“An echo remembers every word — but only the one who listens learns the truth.”",
    ),
    source: t("— Летопись Башни Эха", "— The Chronicle of the Tower of Echoes"),
  },
  caseNumber: 13,
  clues,
  chapters: [
    {
      id: "echo",
      label: t("Глава IV", "Chapter IV"),
      labelAccusative: t("Главу IV", "Chapter IV"),
      title: t("Башня Эха", "The Tower of Echoes"),
      subtitle: t("Аудирование и тайны прошлого", "Listening and secrets of the past"),
      cefr: "B1",
      minutes: 20,
      image: "/images/forgotten-tower.webp",
      icon: "radar",
      description: t(
        "В полночь звонит колокол башни, запертой сто лет. Стражник клянётся, что никто не входил. Узнай, кто лжёт — ветер, призрак или человек.",
        "At midnight the bell rings in a tower locked for a hundred years. The guard swears nobody went in. Find out who is lying — the wind, a ghost, or a person.",
      ),
      skills: t("Past Perfect, Present Perfect, Inference", "Past Perfect, Present Perfect, Inference"),
      mission: t("Доказать, что в башне кто-то был до звона колокола.", "Prove that someone was in the tower before the bell rang."),
      words: ["echo", "guard", "rope", "footprints", "confess"],
      reward: { xp: 200, coins: 60 },
      scenes: [
        {
          kind: "narration",
          id: "e-bell",
          location: tower,
          image: "/images/forgotten-tower.webp",
          text: "Three weeks later, a bell rings at midnight in the Tower of Echoes — a tower that has been locked for a hundred years. Nobody in the academy has the key.",
          translation: t(
            "Три недели спустя в полночь звонит колокол Башни Эха — башни, запертой уже сто лет. Ни у кого в академии нет ключа.",
            "Three weeks later, at midnight, the bell of the Tower of Echoes rings. The tower has been closed for a century, and nobody at the academy has its key.",
          ),
        },
        {
          kind: "dialogue",
          id: "e-guard",
          location: t("Башня Эха • У двери", "The Tower of Echoes • By the door"),
          image: "/images/forgotten-tower.webp",
          lines: [
            {
              speaker: t("Ночной стражник", "The night guard"),
              text: "I've been standing at this door since sunset, and I haven't seen anyone go in.",
              translation: t(
                "Я стою у этой двери с заката и не видел, чтобы кто-то входил.",
                "I have been at this door since the sun went down, and I have not seen anybody enter.",
              ),
            },
            {
              speaker: t("Ты", "You"),
              text: "Then who rang the bell?",
              translation: t("Тогда кто звонил в колокол?", "Then who rang the bell?"),
            },
            {
              speaker: t("Ночной стражник", "The night guard"),
              text: "Perhaps the wind. Perhaps a ghost. I'd rather not know.",
              translation: t(
                "Может, ветер. Может, призрак. Лучше бы мне не знать.",
                "Maybe the wind. Maybe a ghost. I prefer not to find out.",
              ),
            },
          ],
        },
        {
          kind: "question",
          id: "e-wind",
          location: tower,
          image: "/images/forgotten-tower.webp",
          parchment: "All the windows are locked from inside, and the bell is far too heavy for the wind to move.",
          translation: t(
            "Все окна заперты изнутри, а колокол слишком тяжёл, чтобы его раскачал ветер.",
            "Every window is locked on the inside, and the bell is much too heavy for wind to move.",
          ),
          prompt: {
            lead: t("Ты осматриваешь окна башни.", "You check the tower's windows."),
            task: t("Что это значит?", "What does it mean?"),
          },
          options: [
            {
              id: "person",
              label: "A person rang the bell",
              gloss: t("В колокол звонил человек", "Somebody rang it"),
              icon: "door_front",
            },
            { id: "wind", label: "The wind rang the bell", gloss: t("Колокол раскачал ветер", "The wind moved it"), icon: "park" },
            {
              id: "outside",
              label: "The guard rang it from outside",
              gloss: t("Стражник звонил снаружи", "The guard did it from outdoors"),
              icon: "nightlight",
            },
          ],
          maxAttempts: 2,
          xp: 60,
          hint: {
            topic: t("Вывод из текста", "Inference"),
            text: t(
              "Если окна заперты и колокол тяжёлый, может ли его сдвинуть ветер? «Far too heavy» — «слишком тяжёлый».",
              "If the windows are locked and the bell is heavy, can wind move it? «Far too heavy» means much too heavy.",
            ),
          },
          grimoire: {
            title: t("Гримуар «Too + adjective»", "The grimoire of «Too + adjective»"),
            minutes: 2,
            rule: {
              heading: t("Слишком … чтобы:", "Too … to:"),
              formula: "[TOO] + adjective + FOR someone + TO do",
              text: t(
                "«Too heavy for the wind to move» — слишком тяжёлый, чтобы его сдвинул ветер: действие невозможно.",
                "«Too heavy for the wind to move» says the action cannot happen.",
              ),
            },
            deduction: t(
              "Ветер не может сдвинуть колокол, окна заперты изнутри — значит, звонил человек внутри.",
              "The wind cannot move the bell and the windows are locked inside, so a person inside rang it.",
            ),
            quiz: { sentence: "The box is ___ heavy for me to lift.", options: ["too", "enough", "very much"] },
          },
          clue: "closed-windows",
        },
        {
          kind: "puzzle",
          id: "e-cipher",
          location: tower,
          image: "/images/rune-chest.webp",
          parchment: "The bell has not rung for a hundred years.",
          translation: t("Колокол не звонил сто лет.", "The bell has been silent for a hundred years."),
          title: t("Табличка колокола", "The bell's plate"),
          task: t(
            "Буквы на медной табличке перепутаны. Собери надпись в верном порядке.",
            "The letters on the brass plate are mixed up. Put the inscription in the right order.",
          ),
          scroll: t("Медная табличка B1", "Brass plate B1"),
          altar: t("Колокол Эха", "The Echo Bell"),
          tiles: ["has", "The bell", "rung", "not", "for a hundred years"],
          maxAttempts: 2,
          xp: 60,
          hint: {
            topic: t("Present Perfect", "Present Perfect"),
            text: t(
              "Отрицание в Present Perfect: has + not + третья форма глагола. Кто? The bell.",
              "A negative Present Perfect: has + not + past participle. Who? The bell.",
            ),
          },
          grimoire: {
            title: t("Гримуар Present Perfect", "The grimoire of the Present Perfect"),
            minutes: 3,
            rule: {
              heading: t("Отрицание с for:", "Negative with for:"),
              formula: "Subject + [HAS NOT] + past participle + FOR + time",
              text: t(
                "Present Perfect с «for» говорит о том, что длится до сих пор: колокол молчит сто лет и молчал до этой ночи.",
                "The Present Perfect with «for» is about something that lasts up to now.",
              ),
            },
            deduction: t(
              "The bell (кто) + has not (не) + rung (звонил) + for a hundred years (сто лет).",
              "The bell + has not + rung + for a hundred years.",
            ),
            quiz: { sentence: "Nobody ___ opened this door for years.", options: ["has", "have", "is"] },
          },
          clue: "old-bell",
        },
        {
          kind: "choice",
          id: "e-choice",
          location: t("Башня Эха • У двери", "The Tower of Echoes • By the door"),
          image: "/images/forgotten-tower.webp",
          text: "The stairs are dark. The guard is nervous and keeps looking at the floor.",
          translation: t(
            "Лестница тёмная. Стражник нервничает и всё время смотрит в пол.",
            "The stairs have no light. The guard looks worried and does not look at you.",
          ),
          prompt: t("Как поступишь?", "What will you do?"),
          options: [
            {
              id: "press",
              label: "Question the guard again",
              gloss: t("Расспросить стражника ещё раз", "Ask the guard more questions"),
              icon: "door_front",
              to: "e-confess",
              set: ["pressed"],
            },
            {
              id: "climb",
              label: "Climb the stairs alone",
              gloss: t("Подняться по лестнице одному", "Go up by yourself"),
              icon: "stairs",
              to: "e-footprints",
              set: ["climbed"],
            },
          ],
        },
        {
          kind: "dialogue",
          id: "e-confess",
          location: t("Башня Эха • У двери", "The Tower of Echoes • By the door"),
          image: "/images/forgotten-tower.webp",
          lines: [
            {
              speaker: t("Ты", "You"),
              text: "You said you hadn't seen anyone. Is that the whole truth?",
              translation: t(
                "Вы сказали, что никого не видели. Это вся правда?",
                "You told me you had not seen anybody. Is that everything?",
              ),
            },
            {
              speaker: t("Ночной стражник", "The night guard"),
              text: "…I fell asleep for an hour. When I woke up, the door had been opened.",
              translation: t(
                "…Я уснул на час. Когда я проснулся, дверь уже была открыта.",
                "…I slept for an hour. When I woke up, somebody had already opened the door.",
              ),
            },
          ],
          clue: "guard-confession",
          next: "e-tense",
        },
        {
          kind: "narration",
          id: "e-footprints",
          location: stairs,
          image: "/images/shadow-library.webp",
          text: "On the dusty stairs you find footprints. They are small, and they lead up — but none of them come down again.",
          translation: t(
            "На пыльной лестнице — следы. Маленькие, они ведут вверх, но ни один не ведёт обратно вниз.",
            "There are small footprints in the dust on the stairs. They go up, and none come back down.",
          ),
          clue: "dusty-footprints",
          next: "e-tense",
        },
        {
          kind: "question",
          id: "e-tense",
          location: stairs,
          image: "/images/shadow-library.webp",
          parchment: "When the bell rang, the guard ___.",
          translation: t("Когда зазвонил колокол, стражник ___.", "When the bell rang, the guard ___."),
          prompt: {
            lead: t("Ты записываешь в журнал, что случилось этой ночью.", "You write down what happened tonight."),
            task: t("Выбери верную форму глагола.", "Choose the right verb form."),
          },
          options: [
            { id: "had", label: "had fallen asleep", gloss: t("уже уснул (до этого)", "was asleep from earlier"), icon: "nightlight" },
            { id: "has", label: "has fallen asleep", gloss: t("уснул (к настоящему)", "is asleep up to now"), icon: "door_front" },
            { id: "falls", label: "falls asleep", gloss: t("засыпает (обычно)", "usually goes to sleep"), icon: "park" },
          ],
          maxAttempts: 2,
          xp: 60,
          hint: {
            topic: t("Past Perfect", "Past Perfect"),
            text: t(
              "Стражник уснул раньше, чем зазвонил колокол. Какое время ставят для «раньше прошлого»?",
              "The guard fell asleep before the bell rang. Which tense is for “earlier than the past”?",
            ),
          },
          grimoire: {
            title: t("Гримуар Past Perfect", "The grimoire of the Past Perfect"),
            minutes: 3,
            rule: {
              heading: t("Предпрошедшее время:", "The past before the past:"),
              formula: "When + Past Simple, Subject + [HAD] + past participle",
              text: t(
                "Past Perfect показывает действие, случившееся раньше другого действия в прошлом.",
                "The Past Perfect shows an action that happened before another past action.",
              ),
            },
            deduction: t(
              "Сначала стражник уснул, потом зазвонил колокол — значит, had fallen asleep.",
              "First the guard fell asleep, then the bell rang: had fallen asleep.",
            ),
            quiz: { sentence: "She ___ already left when I called.", options: ["had", "has", "is"] },
          },
        },
        {
          kind: "evidence",
          id: "e-proof",
          location: tower,
          image: "/images/forgotten-tower.webp",
          question: "The guard insists that nobody went into the tower tonight.",
          translation: t(
            "Стражник настаивает, что этой ночью никто в башню не входил.",
            "The guard still says nobody entered the tower tonight.",
          ),
          prompt: t("Какая улика доказывает, что он ошибается?", "Which clue proves him wrong?"),
          clues: ["closed-windows", "old-bell", "guard-confession", "dusty-footprints"],
          maxAttempts: 2,
          xp: 60,
          hint: {
            topic: t("Дедукция", "Deduction"),
            text: t(
              "Нужна улика о человеке, который вошёл, а не о колоколе или ветре.",
              "You need a clue about a person who went in, not about the bell or the wind.",
            ),
          },
          grimoire: {
            title: t("Гримуар опровержения", "The grimoire of proving someone wrong"),
            minutes: 2,
            rule: {
              heading: t("Доказать, что кто-то неправ:", "Proving someone wrong:"),
              formula: "The clue [SHOWS THAT] + someone + had + past participle",
              text: t(
                "Чтобы опровергнуть «никто не входил», нужна улика о том, что кто-то вошёл.",
                "To disprove “nobody went in”, you need a clue that someone did.",
              ),
            },
            deduction: t(
              "Окна и табличка говорят о колоколе. О человеке в башне говорят следы или признание.",
              "The windows and the plate are about the bell. The footprints or the confession are about a person.",
            ),
            quiz: { sentence: "The footprints ___ that someone had climbed the stairs.", options: ["show", "shows", "showing"] },
          },
        },
      ],
    },
    {
      id: "archives",
      label: t("Финал саги", "Finale"),
      labelAccusative: t("Финал саги", "the Finale"),
      gate: t("Финальный босс кампании", "The campaign's final boss"),
      title: t("Архивы Архимага", "The Archmage's Archives"),
      subtitle: t("Мастерское испытание всех правил", "A master test of every rule"),
      cefr: "B2",
      minutes: 25,
      image: "/images/archive-mage.webp",
      icon: "nightlight",
      description: t(
        "Следы ведут в Архивы Архимага. С полки пропала книга, которую нельзя читать вслух. Найди вора — и реши, чего он заслуживает.",
        "The tracks lead to the Archmage's Archives. A book that must never be read aloud is gone from its shelf. Find the thief — and decide what they deserve.",
      ),
      skills: t("Third conditional, Reported speech, Using evidence", "Third conditional, Reported speech, Using evidence"),
      mission: t("Найти вора по уликам и решить его судьбу.", "Find the thief from the clues and decide their fate."),
      words: ["archive", "council", "mercy", "confess", "seal"],
      reward: { xp: 250, coins: 80 },
      scenes: [
        {
          kind: "narration",
          id: "a-hall",
          location: archives,
          image: "/images/shadow-library.webp",
          text: "The footprints lead to the Archmage's Archives, where the academy keeps the books that must never be read aloud. One shelf is empty, and the dust around a clean, book-shaped gap has barely been disturbed.",
          translation: t(
            "Следы ведут в Архивы Архимага, где академия хранит книги, которые нельзя читать вслух. Одна полка пуста; пыль вокруг чистого следа от книги почти не тронута.",
            "The footprints go to the Archmage's Archives, where the academy keeps books that are never read aloud. One shelf is empty: there is a clean, book-shaped space, and the dust around it has hardly moved.",
          ),
        },
        {
          kind: "dialogue",
          id: "a-eleanor",
          location: archives,
          image: "/images/grand-library.webp",
          lines: [
            {
              speaker: t("Архимаг Элеонора", "Archmage Eleanor"),
              text: "Had I known the tower was open, I would have sealed the archives myself.",
              translation: t(
                "Знай я, что башня открыта, я бы сама запечатала архивы.",
                "If I had known the tower was open, I would have closed the archives myself.",
              ),
            },
            {
              speaker: t("Ты", "You"),
              text: "Whoever did this knew exactly which book to take.",
              translation: t(
                "Тот, кто это сделал, точно знал, какую книгу брать.",
                "The person who did this knew exactly which book they wanted.",
              ),
            },
            {
              speaker: t("Архимаг Элеонора", "Archmage Eleanor"),
              text: "Then it was someone who knows these shelves as well as I do.",
              translation: t(
                "Значит, это был кто-то, кто знает эти полки так же хорошо, как я.",
                "So it was someone who knows these shelves as well as I do.",
              ),
            },
          ],
        },
        {
          kind: "question",
          id: "a-cond",
          location: archives,
          image: "/images/grand-library.webp",
          parchment: "If the guard had stayed awake, the thief would not have entered.",
          translation: t(
            "Если бы стражник не уснул, вор бы не вошёл.",
            "If the guard had not fallen asleep, the thief could not have come in.",
          ),
          prompt: {
            lead: t("Элеонора записывает на полях архивной книги.", "Eleanor writes in the margin of an archive book."),
            task: t("Что на самом деле произошло?", "What really happened?"),
          },
          options: [
            {
              id: "slept",
              label: "The guard fell asleep, and the thief entered.",
              gloss: t("Стражник уснул, и вор вошёл.", "He slept and the thief came in."),
              icon: "nightlight",
            },
            {
              id: "awake",
              label: "The guard stayed awake, so nobody entered.",
              gloss: t("Стражник не спал, и никто не вошёл.", "He watched and nobody came in."),
              icon: "door_front",
            },
            {
              id: "thief",
              label: "The thief stayed awake all night.",
              gloss: t("Вор не спал всю ночь.", "The thief did not sleep."),
              icon: "skull",
            },
          ],
          maxAttempts: 2,
          xp: 70,
          hint: {
            topic: t("Третий условный тип", "Third conditional"),
            text: t(
              "«If … had stayed, … would not have» — это о том, чего НЕ было. Что тогда было на самом деле?",
              "«If … had stayed, … would not have» is about what did NOT happen. So what did happen?",
            ),
          },
          grimoire: {
            title: t("Гримуар нереального прошлого", "The grimoire of the unreal past"),
            minutes: 3,
            rule: {
              heading: t("Третий условный тип:", "The third conditional:"),
              formula: "If + HAD + past participle, … [WOULD HAVE] + past participle",
              text: t(
                "Так говорят о прошлом, которое не случилось: условие и результат — оба нереальны.",
                "This is for a past that did not happen: both the condition and the result are unreal.",
              ),
            },
            deduction: t(
              "«Если бы не уснул» — значит, уснул. «Вор бы не вошёл» — значит, вошёл.",
              "“If he had stayed awake” means he slept. “The thief would not have entered” means the thief did.",
            ),
            quiz: { sentence: "If you had asked me, I ___ have helped you.", options: ["would", "will", "had"] },
          },
          clue: "ink-stain",
        },
        {
          kind: "puzzle",
          id: "a-cipher",
          location: archives,
          image: "/images/rune-chest.webp",
          parchment: "Whoever reads the book controls the archive.",
          translation: t("Кто читает книгу, тот управляет архивом.", "Any person who reads the book has power over the archive."),
          title: t("Шифр пустой полки", "The empty shelf's cipher"),
          task: t(
            "На пустой полке выцарапана фраза, разбитая на части. Восстанови её.",
            "A phrase is scratched into the empty shelf in pieces. Put it back together.",
          ),
          scroll: t("Шифр архива B2", "Archive cipher B2"),
          altar: t("Полка №13", "Shelf no. 13"),
          tiles: ["controls", "Whoever", "the book", "reads", "the archive"],
          maxAttempts: 2,
          xp: 70,
          hint: {
            topic: t("Придаточное с whoever", "A whoever clause"),
            text: t(
              "«Whoever reads the book» — это подлежащее целиком: «тот, кто читает книгу». Дальше — сказуемое и дополнение.",
              "«Whoever reads the book» is the whole subject. Then comes the verb and the object.",
            ),
          },
          grimoire: {
            title: t("Гримуар «Whoever»", "The grimoire of «Whoever»"),
            minutes: 3,
            rule: {
              heading: t("Придаточное-подлежащее:", "A clause as the subject:"),
              formula: "[WHOEVER] + verb + object → verb + object",
              text: t(
                "«Whoever …» — «тот, кто …»: вся эта часть стоит на месте подлежащего, глагол после неё — в 3-м лице.",
                "«Whoever …» means any person who …; the whole part is the subject, and the verb after it takes -s.",
              ),
            },
            deduction: t(
              "Тот, кто читает книгу (Whoever reads the book) — управляет архивом (controls the archive).",
              "Whoever reads the book — controls the archive.",
            ),
            quiz: { sentence: "___ finds the key will open the door.", options: ["Whoever", "Whatever", "However"] },
          },
          clue: "torn-page",
        },
        {
          kind: "question",
          id: "a-reported",
          location: archives,
          image: "/images/grand-library.webp",
          parchment: "Eleanor told the council that she had never let a student into the archives.",
          translation: t(
            "Элеонора сказала совету, что никогда не пускала учеников в архивы.",
            "Eleanor told the council she had never allowed a student into the archives.",
          ),
          prompt: {
            lead: t("Ты читаешь протокол совета.", "You read the council's record."),
            task: t("Что Элеонора сказала своими словами?", "What did Eleanor say in her own words?"),
          },
          options: [
            {
              id: "never",
              label: "“I have never let a student into the archives.”",
              gloss: t("«Я никогда не пускала учеников в архивы».", "Her words, about her whole life"),
              icon: "local_library",
            },
            {
              id: "will",
              label: "“I will never let a student in.”",
              gloss: t("«Я никогда не пущу ученика».", "A promise about the future"),
              icon: "door_front",
            },
            {
              id: "yesterday",
              label: "“I let a student in yesterday.”",
              gloss: t("«Вчера я впустила ученика».", "The opposite of what she said"),
              icon: "skull",
            },
          ],
          maxAttempts: 2,
          xp: 70,
          hint: {
            topic: t("Косвенная речь", "Reported speech"),
            text: t(
              "В косвенной речи время сдвигается назад: had never let ← have never let.",
              "In reported speech the tense moves back: had never let ← have never let.",
            ),
          },
          grimoire: {
            title: t("Гримуар косвенной речи", "The grimoire of reported speech"),
            minutes: 3,
            rule: {
              heading: t("Сдвиг времён:", "Moving tenses back:"),
              formula: "“I HAVE done” → she said she [HAD] done",
              text: t(
                "Пересказывая чужие слова в прошлом, время сдвигают на шаг назад: Present Perfect → Past Perfect.",
                "When you report past words, move the tense one step back: Present Perfect → Past Perfect.",
              ),
            },
            deduction: t(
              "«Had never let» в пересказе — это «have never let» в её собственных словах.",
              "“Had never let” in the report was “have never let” in her own words.",
            ),
            quiz: { sentence: "He said that he ___ seen the book before.", options: ["had", "has", "have"] },
          },
        },
        {
          kind: "evidence",
          id: "a-proof",
          location: archives,
          image: "/images/shadow-library.webp",
          question: "The council asks how the thief knew which book to take.",
          translation: t(
            "Совет спрашивает, откуда вор знал, какую книгу брать.",
            "The council asks how the thief knew which book to choose.",
          ),
          prompt: t("Какая улика доказывает, что вор хорошо знал архив?", "Which clue proves the thief knew the archive well?"),
          clues: ["ink-stain", "torn-page", "closed-windows", "old-bell"],
          maxAttempts: 2,
          xp: 70,
          hint: {
            topic: t("Дедукция", "Deduction"),
            text: t("Кто в академии пользуется особыми чернилами?", "Who at the academy uses a special ink?"),
          },
          grimoire: {
            title: t("Гримуар выводов", "The grimoire of conclusions"),
            minutes: 2,
            rule: {
              heading: t("Логический вывод:", "A logical conclusion:"),
              formula: "The thief [MUST HAVE] + past participle",
              text: t(
                "«Must have done» — уверенный вывод о прошлом: вор, должно быть, был своим в архиве.",
                "«Must have done» is a sure guess about the past.",
              ),
            },
            deduction: t(
              "Фиолетовыми чернилами пишут только архивариусы — значит, вор из их числа.",
              "Only archivists use violet ink, so the thief must be one of them.",
            ),
            quiz: { sentence: "The thief ___ have known the archive well.", options: ["must", "can", "should to"] },
          },
        },
        {
          kind: "choice",
          id: "a-choice",
          location: archives,
          image: "/images/archive-mage.webp",
          text: "The violet ink leads to Eleanor's own apprentice, Corwin. He is waiting by the door with the book in his hands, shaking.",
          translation: t(
            "Фиолетовые чернила приводят к ученику самой Элеоноры — Корвину. Он ждёт у двери с книгой в руках и дрожит.",
            "The violet ink points to Corwin, Eleanor's own apprentice. He stands by the door holding the book, trembling.",
          ),
          prompt: t("Что ты сделаешь?", "What will you do?"),
          options: [
            {
              id: "reveal",
              label: "Call the council and reveal the thief",
              gloss: t("Позвать совет и назвать вора", "Tell the council who did it"),
              icon: "castle",
              to: "end-justice",
              set: ["revealed"],
            },
            {
              id: "mercy",
              label: "Let Corwin return the book himself",
              gloss: t("Дать Корвину самому вернуть книгу", "Give Corwin a chance"),
              icon: "local_library",
              to: "a-corwin",
              set: ["mercy"],
            },
          ],
        },
        {
          kind: "dialogue",
          id: "a-corwin",
          location: archives,
          image: "/images/archive-mage.webp",
          lines: [
            {
              speaker: t("Корвин", "Corwin"),
              text: "I only wanted to understand the spell that had sealed the tower.",
              translation: t(
                "Я лишь хотел понять заклинание, которым запечатали башню.",
                "I just wanted to understand the spell that closed the tower.",
              ),
            },
            {
              speaker: t("Ты", "You"),
              text: "Then put the book back, and tell Eleanor the truth yourself.",
              translation: t(
                "Тогда верни книгу и сам расскажи Элеоноре правду.",
                "Then return the book and tell Eleanor the truth yourself.",
              ),
            },
          ],
          next: [
            { when: { all: [{ flag: "mercy" }, { flag: "pressed" }] }, to: "end-redemption" },
            { when: { all: [] }, to: "end-mercy" },
          ],
        },
        {
          kind: "ending",
          id: "end-justice",
          location: archives,
          image: "/images/archive-mage.webp",
          title: t("Правосудие совета", "The council's justice"),
          text: "The council takes the book back. Corwin is sent away from the academy, and the archives are sealed for another hundred years.",
          translation: t(
            "Совет забирает книгу. Корвина изгоняют из академии, а архивы запечатывают ещё на сто лет.",
            "The council takes back the book. Corwin must leave the academy, and the archives are closed for another century.",
          ),
          tone: "bittersweet",
          reward: { xp: 250, coins: 60 },
        },
        {
          kind: "ending",
          id: "end-mercy",
          location: archives,
          image: "/images/archive-mage.webp",
          title: t("Второй шанс", "A second chance"),
          text: "Corwin returns the book and confesses. Eleanor forgives him, and the bell of the Tower of Echoes never rings again.",
          translation: t(
            "Корвин возвращает книгу и признаётся. Элеонора прощает его, и колокол Башни Эха больше никогда не звонит.",
            "Corwin brings the book back and tells the truth. Eleanor forgives him, and the bell is silent forever.",
          ),
          tone: "bright",
          reward: { xp: 300, coins: 80 },
        },
        {
          kind: "ending",
          id: "end-redemption",
          location: tower,
          image: "/images/forgotten-tower.webp",
          title: t("Хранители башни", "Keepers of the tower"),
          text: "Corwin confesses — and the night guard, who also told you the truth, stands beside him. Eleanor makes them both keepers of the tower, and at last the echoes fall silent.",
          translation: t(
            "Корвин признаётся — и рядом с ним встаёт ночной стражник, который тоже сказал тебе правду. Элеонора делает их обоих хранителями башни, и эхо наконец стихает.",
            "Corwin tells the truth — and the night guard, who was honest with you too, stands next to him. Eleanor makes them both guardians of the tower, and the echoes finally stop.",
          ),
          tone: "secret",
          reward: { xp: 350, coins: 100 },
        },
      ],
    },
  ],
};

// Word help on the English texts (lib/learning/gloss.ts), placed by the words it marks.
export const echoTower = withGlosses(authored, {
  "e-bell": [
    { phrase: "locked", ru: "заперта", cefr: "A2" },
    {
      phrase: "for a hundred years",
      ru: "сто лет (уже сто лет)",
      note: {
        ru: "Has been locked for… — заперта уже сто лет и до сих пор.",
        en: "Has been locked for…: locked then and still locked now.",
      },
      cefr: "B1",
    },
  ],
  "e-guard": [
    { field: "line:0", phrase: "since sunset", ru: "с заката", cefr: "B1" },
    { field: "line:2", phrase: "I'd rather not know", ru: "я бы предпочёл не знать", cefr: "B2" },
  ],
  "e-wind": [{ phrase: "far too heavy", ru: "слишком тяжёлый", definition: "much heavier than something can move", cefr: "B1" }],
  "e-footprints": [
    { phrase: "dusty", ru: "пыльный", cefr: "B1" },
    { phrase: "footprints", ru: "следы ног", cefr: "B1", occurrence: 0 },
  ],
  "a-hall": [
    { phrase: "empty", ru: "пустая", cefr: "A2" },
    { phrase: "barely been disturbed", ru: "почти не тронута", cefr: "B2" },
  ],
});
