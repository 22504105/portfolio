import type { CampaignKeys } from "@/lib/story/graph";

// Answer keys of "Забытая академия": server and demo only, never a signed-in student's page.

export const forgottenAcademyKeys: CampaignKeys = {
  "prologue-1": {
    kind: "question",
    correct: "whisper",
    explanations: {
      whisper: {
        ru: "«Be quiet» — вести себя тихо: в библиотеке говорят шёпотом.",
        en: "“Be quiet” means make little noise: in a library people speak softly.",
      },
      eat: { ru: "В правиле нет ни слова о еде.", en: "The rule says nothing about food." },
      sleep: { ru: "Quiet — не значит «спать»: это про тишину.", en: "Quiet does not mean asleep: it is about noise." },
    },
    grimoire: "must",
  },
  "tower-1": {
    kind: "question",
    correct: "archivist",
    explanations: {
      archivist: { ru: "«Сова и луна — знак хранителя библиотеки.»", en: "“The owl and the moon are the sign of the library's keeper.”" },
      cook: { ru: "«Печать повара — ложка, а не сова.»", en: "“The cook's seal is a spoon, not an owl.”" },
      guard: { ru: "«У стражника нет своей печати.»", en: "“The guard has no seal of his own.”" },
    },
    grimoire: "archivist's",
  },
  "tower-2": {
    kind: "question",
    correct: "cellar",
    explanations: {
      cellar: {
        ru: "«Подземелье без окон — глубоко под башней, куда лунный свет никогда не проникает.»",
        en: "“A room with no windows, deep under the tower, where moonlight never reaches.”",
      },
      garden: {
        ru: "«В саду лунный свет падает прямо на кроны деревьев и тропы. Это не то место.»",
        en: "“In the garden the moonlight falls straight onto the trees and paths. This is not the place.”",
      },
      tower: {
        ru: "«Шпиль открыт небу: луна заглядывает в его окна каждую ночь. Это не то место.»",
        en: "“The spire is open to the sky: the moon looks through its windows every night. This is not the place.”",
      },
    },
    grimoire: "never",
  },
  "tower-3": {
    kind: "puzzle",
    order: ["We", "found", "the", "key"],
    explanation: { ru: "We found the key — «Мы нашли ключ». Сундук открыт!", en: "“We found the key.” The chest is open!" },
    grimoire: "found",
  },
  "tower-4": {
    kind: "question",
    correct: "midnight",
    explanations: {
      midnight: { ru: "«Only at midnight» — только в полночь.", en: "“Only at midnight”: at no other time." },
      morning: {
        ru: "«Утром дверь заперта: в манускрипте сказано — только в полночь.»",
        en: "“In the morning the door is locked: the manuscript says only at midnight.”",
      },
      always: { ru: "«Only» — значит «только»: не в любое время.", en: "“Only” means at that one time, not at any time." },
    },
    grimoire: "only",
  },
  "tower-5": {
    kind: "question",
    correct: "water",
    explanations: {
      water: { ru: "«Follow the sound of water» — иди на звук воды.", en: "“Follow the sound of water”: go where you hear water." },
      crypt: { ru: "Это не то место: карта ведёт к воде.", en: "This is not the place: the map leads to water." },
      stairs: { ru: "«Карта ведёт вперёд, на север, а не назад.»", en: "“The map leads on, to the north, not back.”" },
    },
    grimoire: "follow",
  },
  "f-riddle": {
    kind: "question",
    correct: "tree",
    explanations: {
      tree: {
        ru: "Старое мудрое дерево спит зимой и просыпается весной.",
        en: "An old wise tree sleeps in winter and wakes up in spring.",
      },
      river: { ru: "Река не спит зимой — она течёт подо льдом.", en: "A river does not sleep in winter: it runs under the ice." },
      stone: { ru: "Камень не просыпается весной — он спит всегда.", en: "A stone does not wake up in spring: it is always still." },
    },
    grimoire: "wise",
  },
  "f-proof": {
    kind: "evidence",
    correct: ["seal"],
    explanations: {
      seal: {
        ru: "Печать с совой — знак архивариуса: письмо написала она.",
        en: "The owl seal is the archivist's sign: she wrote the letter.",
      },
      "bronze-key": {
        ru: "Ключ открывает подвал, но не говорит, кто писал письмо.",
        en: "The key opens the cellar, but does not say who wrote the letter.",
      },
      manuscript: {
        ru: "Манускрипт говорит, когда открыть дверь, а не кто писал письмо.",
        en: "The manuscript says when to open the door, not who wrote the letter.",
      },
      "moon-amulet": { ru: "Амулет — то, что искали, а не подпись автора.", en: "The amulet is what was hidden, not the writer's name." },
    },
    grimoire: "proves",
  },
  "f-thanks": {
    kind: "question",
    correct: "welcome",
    explanations: {
      welcome: { ru: "«You're welcome» — вежливый ответ на благодарность.", en: "“You're welcome” is the polite answer to thanks." },
      giveback: { ru: "Это приказ, а не ответ на благодарность.", en: "That is an order, not an answer to thanks." },
      dontcare: { ru: "Так ответить грубо.", en: "That is a rude answer." },
    },
    grimoire: "welcome",
  },
};
