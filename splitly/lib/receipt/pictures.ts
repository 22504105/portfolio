// Which picture stands beside a line of a receipt. The pictures are drawn
// icons kept in the site itself, one per kind of everyday product; a line is
// matched to one by the words in its name, in English, Russian or Turkish.
// A name nothing matches gets the plain shopping bag: never a photograph, and
// never a picture of some particular product the line might not be.

export const PICTURES = [
  "milk",
  "bread",
  "eggs",
  "chicken",
  "meat",
  "fish",
  "fruit",
  "vegetables",
  "grains",
  "water",
  "softDrink",
  "coffee",
  "beer",
  "wine",
  "sweets",
  "iceCream",
  "pizza",
  "meal",
  "cleaning",
  "hygiene",
  "pharmacy",
  "baby",
  "pet",
  "tobacco",
  "fuel",
  "ticket",
  "other",
] as const;
export type Picture = (typeof PICTURES)[number];

/** Pictures share a tint by family, so a receipt reads at a glance: dairy and eggs, bakery, meat and fish, and so on. */
export const FAMILIES = ["dairy", "bakery", "meat", "produce", "drinks", "sweets", "home", "other"] as const;
export type Family = (typeof FAMILIES)[number];

export const FAMILY_OF: Record<Picture, Family> = {
  milk: "dairy",
  eggs: "dairy",
  bread: "bakery",
  grains: "bakery",
  pizza: "bakery",
  meal: "bakery",
  chicken: "meat",
  meat: "meat",
  fish: "meat",
  fruit: "produce",
  vegetables: "produce",
  water: "drinks",
  softDrink: "drinks",
  coffee: "drinks",
  beer: "drinks",
  wine: "drinks",
  sweets: "sweets",
  iceCream: "sweets",
  cleaning: "home",
  hygiene: "home",
  pharmacy: "home",
  baby: "home",
  pet: "home",
  tobacco: "other",
  fuel: "other",
  ticket: "other",
  other: "other",
};

// The beginnings of words: "молок" finds "молоко" and "молока", "süt" finds "SÜT 1L". A beginning that ends in a
// space must be the whole word ("ham " is ham, not hamburger). Earlier rows win, so the more particular kinds come
// first: ice cream before cream, chicken before meat.
const WORDS: readonly [Picture, string][] = [
  ["iceCream", "ice cream|icecream|морожен|dondurma|gelato"],
  ["eggs", "egg|яйц|яиц|yumurta"],
  [
    "milk",
    "milk|молок|süt|kefir|кефир|yogurt|yoghurt|йогурт|yoğurt|ayran|айран|cheese|сыр|peynir|kaşar|butter|tereyağ|cream|сливк|сметан|kaymak|творог",
  ],
  ["pizza", "pizza|пицц|pide|lahmacun"],
  ["bread", "bread|хлеб|ekmek|батон|булк|булоч|baguette|багет|simit|симит|лаваш|lavaş|croissant|круассан|poğaça|börek|бурек|toast"],
  ["chicken", "chicken|куриц|курин|tavuk|piliç|turkey|индейк|hindi"],
  ["fish", "fish|рыб|balık|salmon|лосос|сёмг|somon|tuna|тунец|ton balığ|shrimp|кревет|karides|levrek|çupra|hamsi|форел"],
  [
    "meat",
    "meat|мясо|мясн|beef|говядин|dana |kıyma|фарш|pork|свинин|lamb|баранин|kuzu|sausage|колбас|сосиск|sucuk|sosis|ham |ветчин|bacon|бекон|köfte|котлет|kebab|kebap|кебаб|steak|стейк|pastırma|salam",
  ],
  [
    "fruit",
    "fruit|фрукт|meyve |apple|яблок|elma|banana|банан|muz |orange|апельсин|portakal|lemon |лимон |limon |grape|виноград|üzüm|strawberr|клубник|çilek|cherry|вишн|черешн|kiraz|peach|персик|şeftali|pear|груш|armut|watermelon|арбуз|karpuz|melon|дын|kavun|mandalina|мандарин|nar |гранат|ягод|berry",
  ],
  [
    "vegetables",
    "vegetable|овощ|sebze|tomato|помидор|томат|domates|cucumber|огур|salatalık|potato|картоф|patates|onion|лук|soğan|carrot|морков|havuç|pepper|перец|перц|biber|cabbage|капуст|lahana|salad|салат|salata|marul|garlic|чеснок|sarımsak|eggplant|баклажан|patlıcan|zucchini|кабач|kabak|mushroom|гриб|mantar|зелен|maydanoz|укроп|ıspanak|шпинат",
  ],
  [
    "grains",
    "rice|рис |риса |pirinç|pasta|макарон|makarna|spaghetti|спагетти|flour|мука |un |bulgur|булгур|гречк|oat|овсян|yulaf|cereal|хлопь|müsli|мюсли|nohut|нут |mercimek|чечевиц|fasulye|фасол|bean",
  ],
  ["coffee", "coffee|кофе|kahve|latte|латте|cappuccino|капучино|espresso|эспрессо|americano|американо|tea |чай|çay "],
  ["beer", "beer|пиво|пива |bira|efes|tuborg|lager|ale "],
  ["wine", "wine|вино |вина |şarap|champagne|шампанск|prosecco|vodka|водк|rakı|ракы|whisk|виски|cocktail|коктейл|gin |rum |ром "],
  [
    "softDrink",
    "cola|кола|pepsi|пепси|fanta|фанта|sprite|спрайт|juice|сок |meyve suyu|lemonade|лимонад|limonata|gazoz|ice tea|icetea|energy|энергет|напит|içecek|drink",
  ],
  ["water", "water|вода |воды |воду |su |maden suyu|минерал|soda"],
  [
    "sweets",
    "chocolate|шоколад|çikolata|candy|конфет|şeker|сахар|sugar|cookie|печень|bisküvi|cake|торт|пирож|baklava|пахлав|lokum|лукум|halva|халва|helva|waffle|вафл|gofret|donut|пончик|tatlı|десерт|dessert|honey|мёд |bal |jam |варень|reçel|chips|чипс|cips|nut|орех|fındık|fıstık|ceviz|çekirdek",
  ],
  [
    "meal",
    "burger|бургер|sandwich|сэндвич|сендвич|döner|донер|шаурм|dürüm|wrap|soup|суп|çorba|чорба|menu|menü|меню|lunch|обед|dinner|ужин|breakfast|завтрак|kahvaltı|mantı|манты|pilav|плов|sushi|суши|ролл|noodle|лапш|tost|omlet|омлет|пельмен|вареник",
  ],
  [
    "cleaning",
    "detergent|deterjan|стирал|порошок|порошк|bleach|отбелив|çamaşır suyu|yumuşatıcı|для посуд|bulaşık|cleaner|чистящ|temizl|sponge|губк|sünger|trash bag|мусорн|çöp poşet|napkin|салфет|peçete|paper towel|havlu|foil|фольг|folyo|средство для",
  ],
  [
    "hygiene",
    "shampoo|шампун|şampuan|soap|мыло|мыла |sabun|toothpaste|зубн|diş macun|toilet paper|туалетн|tuvalet kağıd|shower|гель для душ|duş jel|deodorant|дезодорант|razor|бритв|tıraş|tampon|тампон|прокладк|ped |крем |krem |cosmetic|космет",
  ],
  [
    "pharmacy",
    "pharmacy|аптек|eczane|medicine|лекарств|ilaç|tablet|таблетк|vitamin|витамин|aspirin|аспирин|parol|bandage|бинт|пластыр|yara bandı|mask|маск",
  ],
  ["baby", "diaper|подгузн|памперс|bebek bezi|baby|детск|bebek|mama "],
  ["pet", "cat food|dog food|корм|kedi maması|köpek maması|pet |наполнител|kedi kumu"],
  ["tobacco", "cigarette|сигарет|sigara|tobacco|табак|tütün|vape|вейп|зажигал|çakmak"],
  ["fuel", "fuel|топлив|yakıt|petrol|бензин|benzin|diesel|дизел|motorin|lpg "],
  ["ticket", "ticket|билет|bilet|museum|музе|müze|cinema|кино|sinema|entrance|вход|giriş|tour |экскурс|tur "],
];

/**
 * A name made plain for matching: lower case, accents and Turkish dots
 * dropped ("SÜT" and "sut" are one word, "ё" is "е"), everything that is not
 * a letter or a digit turned into a space, a space at each end.
 */
export function fold(label: string): string {
  return ` ${label} `
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ");
}

const FOLDED: readonly [Picture, readonly string[]][] = WORDS.map(([picture, stems]) => [
  picture,
  // Folding puts a space at each end: the one in front is the start of a word, the one behind is kept only if it was written.
  stems.split("|").map((stem) => (stem.endsWith(" ") ? fold(stem.trimEnd()) : fold(stem).trimEnd())),
]);

/** The picture for a line by its name: the first kind one of whose words begins a word of the name. */
export function pictureOf(label: string): Picture {
  const name = fold(label);
  for (const [picture, stems] of FOLDED) if (stems.some((stem) => name.includes(stem))) return picture;
  return "other";
}
