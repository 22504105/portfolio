import type { Barber, Catalog, Service, WorkingRange } from "./types";

// The catalog as a constant, a copy of supabase/seed.sql, served when no
// database is configured. tests/db/foundation.test.ts fails if this copy and
// the seed drift apart.
// Ids are the slugs here; in the database they are UUIDs, and nothing in the
// interface may depend on what an id looks like.

const service = (
  slug: string,
  en: [string, string],
  ru: [string, string],
  priceCents: number,
  durationMinutes: number,
): Service => ({
  id: slug,
  slug,
  name: { en: en[0], ru: ru[0] },
  description: { en: en[1], ru: ru[1] },
  priceCents,
  durationMinutes,
});

const services: Service[] = [
  service(
    "haircut",
    ["Haircut", "Consultation, scissor or clipper cut, wash and finish."],
    ["Стрижка", "Консультация, стрижка ножницами или машинкой, мытьё и укладка."],
    4500,
    45,
  ),
  service(
    "skin-fade",
    ["Skin Fade", "A tight fade taken down to the skin, blended by hand."],
    ["Фейд под ноль", "Плотный переход до кожи, выведенный вручную."],
    5000,
    50,
  ),
  service(
    "haircut-and-beard",
    ["Haircut & Beard", "A full cut and a shaped beard in one sitting."],
    ["Стрижка и борода", "Стрижка и оформление бороды за один визит."],
    6800,
    65,
  ),
  service(
    "beard-trim",
    ["Beard Trim", "Shape, line and length, finished with oil."],
    ["Оформление бороды", "Форма, контур и длина, в завершение — масло."],
    2800,
    25,
  ),
  service(
    "hot-towel-shave",
    ["Hot Towel Shave", "A straight-razor shave with hot towels and a cold finish."],
    ["Бритьё с горячим полотенцем", "Бритьё опасной бритвой с горячими полотенцами и холодным компрессом."],
    4800,
    40,
  ),
  service(
    "buzz-cut",
    ["Buzz Cut", "One length all over, edges squared off."],
    ["Стрижка под машинку", "Одна длина по всей голове, чёткая окантовка."],
    3000,
    25,
  ),
  service(
    "kids-cut",
    ["Kids' Cut", "For under-twelves. Patience included."],
    ["Детская стрижка", "Для детей до двенадцати лет. Терпение входит в стоимость."],
    3200,
    30,
  ),
  service(
    "grey-blending",
    ["Grey Blending", "A soft colour pass that tones grey down without hiding it."],
    ["Камуфляж седины", "Мягкое тонирование, которое приглушает седину, не скрывая её полностью."],
    4000,
    35,
  ),
];

/** Working ranges for several weekdays that share the same hours. */
const days = (weekdays: number[], ...ranges: [string, string][]): WorkingRange[] =>
  weekdays.flatMap((weekday) => ranges.map(([start, end]) => ({ weekday, start, end })));

const barbers: Barber[] = [
  {
    id: "marcus-hale",
    slug: "marcus-hale",
    name: "Marcus Hale",
    title: { en: "Head Barber", ru: "Главный барбер" },
    bio: {
      en: "Fifteen years behind the chair. Marcus cuts classic shapes and keeps the razor work for himself.",
      ru: "Пятнадцать лет за креслом. Маркус делает классические формы, а работу с бритвой оставляет себе.",
    },
    serviceIds: ["haircut", "haircut-and-beard", "beard-trim", "hot-towel-shave", "buzz-cut"],
    hours: [
      ...days([2, 3, 4], ["10:00", "14:00"], ["15:00", "19:00"]),
      ...days([5], ["10:00", "14:00"], ["15:00", "20:00"]),
      ...days([6], ["09:00", "13:00"], ["14:00", "18:00"]),
    ],
  },
  {
    id: "daniyar-akhmetov",
    slug: "daniyar-akhmetov",
    name: "Daniyar Akhmetov",
    title: { en: "Senior Barber", ru: "Старший барбер" },
    bio: {
      en: "Fades are his subject. Daniyar works slowly at the temples and it shows.",
      ru: "Его тема — фейды. Данияр не торопится на висках, и это заметно.",
    },
    serviceIds: ["haircut", "skin-fade", "buzz-cut", "kids-cut", "beard-trim"],
    hours: [
      ...days([3, 4, 5], ["11:00", "15:00"], ["16:00", "20:00"]),
      ...days([6], ["09:00", "13:00"], ["14:00", "18:00"]),
      ...days([7], ["11:00", "17:00"]),
    ],
  },
  {
    id: "theo-okafor",
    slug: "theo-okafor",
    name: "Theo Okafor",
    title: { en: "Barber", ru: "Барбер" },
    bio: {
      en: "Texture, curls and longer cuts. Theo is the one to ask about growing it out.",
      ru: "Текстура, кудри и удлинённые стрижки. К Тео идут, когда хотят отрастить.",
    },
    serviceIds: ["haircut", "skin-fade", "kids-cut", "buzz-cut"],
    hours: [
      ...days([2, 3, 4], ["10:00", "13:30"], ["14:30", "19:00"]),
      ...days([5], ["10:00", "13:30"], ["14:30", "20:00"]),
      ...days([7], ["11:00", "17:00"]),
    ],
  },
  {
    id: "leon-fischer",
    slug: "leon-fischer",
    name: "Leon Fischer",
    title: { en: "Barber", ru: "Барбер" },
    bio: {
      en: "Beards and colour. Leon handles grey blending and anything with a sharp line.",
      ru: "Бороды и цвет. Леон делает камуфляж седины и всё, где нужен чёткий контур.",
    },
    serviceIds: ["haircut", "haircut-and-beard", "beard-trim", "hot-towel-shave", "grey-blending"],
    hours: [
      ...days([2], ["10:00", "14:00"], ["15:00", "19:00"]),
      ...days([4], ["12:00", "16:00"], ["17:00", "20:00"]),
      ...days([5], ["10:00", "14:00"], ["15:00", "20:00"]),
      ...days([6], ["09:00", "13:00"], ["14:00", "18:00"]),
    ],
  },
];

export const mockCatalog: Catalog = {
  shop: {
    name: "CUT&CO",
    addressLine1: "27 Calvert Yard",
    city: "London",
    postcode: "E2 7JQ",
    phone: "+44 20 7946 0127",
    email: "hello@cutco.example",
    policy: {
      holdMinutes: 15,
      slotIntervalMinutes: 30,
      minLeadMinutes: 120,
      horizonDays: 30,
      changeCutoffHours: 12,
      maxBreakMinutes: 120,
    },
  },
  services,
  barbers,
};
