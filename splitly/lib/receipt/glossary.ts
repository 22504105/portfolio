import type { TranslationSource } from "./types";

// Translating what a receipt says: a word list, not a translator. It knows a
// few hundred everyday things people buy together, in Turkish, English and
// Russian. A name it does not know is left exactly as printed and marked
// "untranslated": nothing is ever made up, and the printed text is always
// kept beside whatever is shown.

type Entry = { en: string; ru: string; /** Other spellings as printed on receipts: Turkish, abbreviations. */ also: string[] };

const E = (en: string, ru: string, ...also: string[]): Entry => ({ en, ru, also });

const ENTRIES: readonly Entry[] = [
  // Dairy and eggs
  E("Milk", "Молоко", "sut", "süt"),
  E("Yoghurt", "Йогурт", "yogurt", "yoğurt"),
  E("Ayran", "Айран", "ayran"),
  E("Kefir", "Кефир", "kefir"),
  E("Cheese", "Сыр", "peynir"),
  E("White cheese", "Брынза", "beyaz peynir"),
  E("Kashar cheese", "Сыр кашар", "kasar", "kaşar", "kasar peyniri"),
  E("Butter", "Сливочное масло", "tereyagi", "tereyağı", "tereyag"),
  E("Cream", "Сливки", "krema"),
  E("Eggs", "Яйца", "yumurta", "egg"),
  // Bread and grains
  E("Bread", "Хлеб", "ekmek"),
  E("Simit", "Симит", "simit"),
  E("Rice", "Рис", "pirinc", "pirinç"),
  E("Pasta", "Макароны", "makarna"),
  E("Flour", "Мука", "un"),
  E("Bulgur", "Булгур", "bulgur"),
  E("Lentils", "Чечевица", "mercimek"),
  E("Chickpeas", "Нут", "nohut"),
  E("Beans", "Фасоль", "fasulye"),
  // Meat and fish
  E("Chicken", "Курица", "tavuk", "pilic", "piliç"),
  E("Chicken breast", "Куриное филе", "tavuk gogsu", "tavuk göğsü", "tavuk gogus", "pilic gogus", "chicken fillet"),
  E("Beef", "Говядина", "dana", "dana eti", "sigir eti"),
  E("Minced meat", "Фарш", "kiyma", "kıyma"),
  E("Lamb", "Баранина", "kuzu", "kuzu eti"),
  E("Meat", "Мясо", "et"),
  E("Sausage", "Колбаса", "sucuk", "sosis", "salam"),
  E("Fish", "Рыба", "balik", "balık"),
  E("Salmon", "Лосось", "somon"),
  // Fruit and vegetables
  E("Tomatoes", "Помидоры", "domates", "tomato"),
  E("Cucumbers", "Огурцы", "salatalik", "salatalık", "cucumber"),
  E("Potatoes", "Картофель", "patates", "potato"),
  E("Onions", "Лук", "sogan", "soğan", "onion"),
  E("Garlic", "Чеснок", "sarimsak", "sarımsak"),
  E("Peppers", "Перец", "biber", "pepper"),
  E("Aubergine", "Баклажан", "patlican", "patlıcan", "eggplant"),
  E("Carrots", "Морковь", "havuc", "havuç", "carrot"),
  E("Lettuce", "Салат", "marul"),
  E("Lemon", "Лимон", "limon"),
  E("Apples", "Яблоки", "elma", "apple"),
  E("Bananas", "Бананы", "muz", "banana"),
  E("Oranges", "Апельсины", "portakal", "orange"),
  E("Grapes", "Виноград", "uzum", "üzüm"),
  E("Watermelon", "Арбуз", "karpuz"),
  E("Strawberries", "Клубника", "cilek", "çilek"),
  E("Olives", "Оливки", "zeytin"),
  // Pantry
  E("Olive oil", "Оливковое масло", "zeytinyagi", "zeytinyağı"),
  E("Sunflower oil", "Подсолнечное масло", "aycicek yagi", "ayçiçek yağı", "aycicek"),
  E("Sugar", "Сахар", "seker", "şeker"),
  E("Salt", "Соль", "tuz"),
  E("Honey", "Мёд", "bal"),
  E("Jam", "Варенье", "recel", "reçel"),
  E("Tomato paste", "Томатная паста", "salca", "salça"),
  E("Chocolate", "Шоколад", "cikolata", "çikolata"),
  E("Biscuits", "Печенье", "biskuvi", "bisküvi", "cookies"),
  E("Crisps", "Чипсы", "cips", "chips"),
  E("Nuts", "Орехи", "kuruyemis", "kuruyemiş", "findik", "fındık"),
  E("Ice cream", "Мороженое", "dondurma"),
  // Drinks
  E("Water", "Вода", "su"),
  E("Sparkling water", "Газированная вода", "soda", "maden suyu"),
  E("Tea", "Чай", "cay", "çay"),
  E("Coffee", "Кофе", "kahve"),
  E("Turkish coffee", "Кофе по-турецки", "turk kahvesi", "türk kahvesi"),
  E("Juice", "Сок", "meyve suyu"),
  E("Cola", "Кола", "kola", "coca cola", "coke"),
  E("Beer", "Пиво", "bira"),
  E("Wine", "Вино", "sarap", "şarap"),
  E("Raki", "Ракы", "raki", "rakı"),
  E("Lemonade", "Лимонад", "limonata"),
  // Eating out
  E("Soup", "Суп", "corba", "çorba"),
  E("Lentil soup", "Чечевичный суп", "mercimek corbasi", "mercimek çorbası"),
  E("Salad", "Салат", "salata"),
  E("Kebab", "Кебаб", "kebap", "kebab"),
  E("Adana kebab", "Адана-кебаб", "adana", "adana kebap"),
  E("Doner", "Донер", "doner", "döner"),
  E("Lahmacun", "Лахмаджун", "lahmacun"),
  E("Pide", "Пиде", "pide"),
  E("Pizza", "Пицца", "pizza"),
  E("Burger", "Бургер", "hamburger"),
  E("Meatballs", "Кёфте", "kofte", "köfte"),
  E("Fries", "Картофель фри", "patates kizartmasi", "patates kızartması", "french fries"),
  E("Meze", "Мезе", "meze"),
  E("Baklava", "Пахлава", "baklava"),
  E("Dessert", "Десерт", "tatli", "tatlı"),
  E("Breakfast", "Завтрак", "kahvalti", "kahvaltı"),
  E("Sandwich", "Сэндвич", "sandvic", "sandviç", "tost"),
  // Household
  E("Laundry detergent", "Средство для стирки", "deterjan", "camasir deterjani", "çamaşır deterjanı", "detergent"),
  E("Dish soap", "Средство для посуды", "bulasik deterjani", "bulaşık deterjanı", "bulasik"),
  E("Soap", "Мыло", "sabun"),
  E("Shampoo", "Шампунь", "sampuan", "şampuan"),
  E("Toothpaste", "Зубная паста", "dis macunu", "diş macunu"),
  E("Toilet paper", "Туалетная бумага", "tuvalet kagidi", "tuvalet kağıdı"),
  E("Paper towels", "Бумажные полотенца", "kagit havlu", "kağıt havlu"),
  E("Napkins", "Салфетки", "pecete", "peçete"),
  E("Bin bags", "Мусорные пакеты", "cop torbasi", "çöp torbası", "cop poseti"),
  E("Bag", "Пакет", "poset", "poşet"),
  E("Sponge", "Губка", "sunger", "sünger"),
  // Getting around and living
  E("Taxi", "Такси", "taksi"),
  E("Fuel", "Топливо", "benzin", "motorin", "akaryakit", "petrol", "gasoline"),
  E("Parking", "Парковка", "otopark"),
  E("Ticket", "Билет", "bilet"),
  E("Rent", "Аренда", "kira"),
  E("Electricity", "Электричество", "elektrik"),
  E("Internet", "Интернет", "internet"),
  E("Groceries", "Продукты", "market", "gida", "gıda"),
];

export type DisplayLanguage = "en" | "ru";

const fold = (text: string) =>
  text
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // Sizes and counts printed in a name ("1 L", "500 GR", "x2", "%8") are not part of what the thing is.
    .replace(/\b\d+([.,]\d+)?\s?(kg|gr?|g|lt?|l|ml|cl|ad|adet|pcs?|шт|кг|г|л|мл)\b\.?/giu, " ")
    .replace(/[%*x×]\s?\d+/g, " ")
    .replace(/\b\d+([.,]\d+)?\b/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

// Every spelling → its entry. Built once.
const INDEX = new Map<string, Entry>();
for (const entry of ENTRIES) for (const spelling of [entry.en, entry.ru, ...entry.also]) INDEX.set(fold(spelling), entry);

/** The size or count a name carries ("1 L", "500 gr"), kept and shown after the translated word. */
function sizeOf(label: string): string {
  const match = /\b\d+([.,]\d+)?\s?(kg|gr?|g|lt?|l|ml|cl|кг|г|л|мл)\b/iu.exec(label);
  if (!match) return "";
  const unit = match[2].toLowerCase();
  const shown = { kg: "kg", gr: "g", g: "g", lt: "l", l: "l", ml: "ml", cl: "cl", кг: "кг", г: "г", л: "л", мл: "мл" }[unit] ?? unit;
  return `${match[0].slice(0, match[0].length - match[2].length).trim()} ${shown}`;
}

const UNIT_RU: Record<string, string> = { kg: "кг", g: "г", l: "л", ml: "мл", cl: "сл" };

export type Translated = { text: string; source: TranslationSource };

/**
 * A printed name in the chosen language. First the person's own corrections
 * (`mine`: printed text → what they called it), then the word list: the whole
 * name, then its longest run of words that the list knows. Otherwise the
 * name comes back as printed, with source "none".
 */
export function translateLabel(label: string, language: DisplayLanguage, mine: Readonly<Record<string, string>> = {}): Translated {
  const folded = fold(label);
  if (!folded) return { text: label.trim(), source: "none" };
  const own = mine[folded];
  if (own) return { text: own, source: "user" };

  const words = folded.split(" ");
  let found: Entry | undefined;
  // The longest run of neighbouring words first: "tavuk gogsu" before "tavuk".
  for (let length = Math.min(words.length, 4); length >= 1 && !found; length--) {
    for (let start = 0; start + length <= words.length && !found; start++) found = INDEX.get(words.slice(start, start + length).join(" "));
  }
  if (!found) return { text: label.trim(), source: "none" };

  const size = sizeOf(label);
  const shownSize = language === "ru" ? size.replace(/[a-z]+$/, (unit) => UNIT_RU[unit] ?? unit) : size;
  return { text: [found[language], shownSize].filter(Boolean).join(" "), source: "glossary" };
}

/** The key under which a person's own correction for a printed name is remembered. */
export const correctionKey = fold;

export const GLOSSARY_SIZE = ENTRIES.length;
