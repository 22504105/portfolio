import type { Lang } from "./i18n";

type Text = Record<Lang, string>;

export type Shot = {
  /** File name in `public/shots/<slug>/`, produced by `npm run sync`. */
  file: string;
  /** Source file, relative to the repository root. */
  source: string;
  kind: "desktop" | "phone";
  caption: Text;
};

export type Link = { label: Text; href: string };

export type Project = {
  slug: string;
  name: string;
  /** Folder of the project in the repository and of its case study in `showcase/`. */
  folder: string;
  showcase: string;
  kind: Text;
  tagline: Text;
  status: Text;
  /** "live" = fully working demo; "limited" = live with a stated limitation. */
  statusTone: "live" | "limited";
  stack: string[];
  demo: string;
  links: Link[];
  /** Automated tests passing on 2026-10-27; null when the project has none. */
  tests: number | null;
  limitations: Record<Lang, string[]>;
  shots: Shot[];
};

const repo = "https://github.com/22504105/portfolio/tree/main";

export const projects: Project[] = [
  {
    slug: "nova-residence",
    name: "NOVA Residence",
    folder: "nova-residence",
    showcase: "nova-residence",
    kind: { en: "Real-estate landing page", ru: "Лендинг недвижимости" },
    tagline: {
      en: "A premium one-page site for a fictional Istanbul development: editorial design, residences with floor plans, gallery and a viewing request form.",
      ru: "Премиальный одностраничный сайт вымышленного ЖК в Стамбуле: журнальный дизайн, квартиры с планировками, галерея и форма заявки на показ.",
    },
    status: { en: "Completed concept, deployed", ru: "Концепт завершён, опубликован" },
    statusTone: "live",
    stack: ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS 4", "Motion"],
    demo: "https://nova-residence-five.vercel.app",
    links: [{ label: { en: "Live site", ru: "Сайт" }, href: "https://nova-residence-five.vercel.app" }],
    tests: null,
    limitations: {
      en: [
        "Presentation site: the viewing form validates input but sends and stores nothing.",
        "Photography was generated for the project and shows a fictional building.",
      ],
      ru: [
        "Презентационный сайт: форма заявки проверяет поля, но ничего не отправляет и не хранит.",
        "Фотографии сгенерированы для проекта и показывают вымышленное здание.",
      ],
    },
    shots: [
      { file: "hero.webp", source: "nova-residence/docs/screenshots/hero.jpg", kind: "desktop", caption: { en: "First screen", ru: "Первый экран" } },
      { file: "residence-details.webp", source: "nova-residence/docs/screenshots/residence-details.jpg", kind: "desktop", caption: { en: "Residence drawer with a floor plan drawn from data", ru: "Панель квартиры с планировкой из данных" } },
      { file: "gallery.webp", source: "nova-residence/docs/screenshots/gallery.jpg", kind: "desktop", caption: { en: "Editorial gallery", ru: "Журнальная галерея" } },
      { file: "contact.webp", source: "nova-residence/docs/screenshots/contact.jpg", kind: "desktop", caption: { en: "Viewing request form", ru: "Форма заявки на показ" } },
      { file: "mobile-hero.webp", source: "nova-residence/docs/screenshots/mobile-hero.jpg", kind: "phone", caption: { en: "First screen on a phone", ru: "Первый экран на телефоне" } },
      { file: "mobile-residences.webp", source: "nova-residence/docs/screenshots/mobile-residences.jpg", kind: "phone", caption: { en: "Residences on a phone", ru: "Квартиры на телефоне" } },
    ],
  },
  {
    slug: "cut-and-co",
    name: "CUT&CO",
    folder: "barbershop-demo",
    showcase: "cut-and-co",
    kind: { en: "Booking system", ru: "Система онлайн-записи" },
    tagline: {
      en: "A barbershop site with online booking, email confirmation, client, barber and admin workspaces, analytics and PWA. Double booking is impossible at the database level.",
      ru: "Сайт барбершопа с онлайн-записью, подтверждением по почте, кабинетами клиента, мастера и администратора, аналитикой и PWA. Двойная запись исключена на уровне базы данных.",
    },
    status: {
      en: "Built and tested; live as a demo without its database",
      ru: "Сделан и протестирован; опубликован как демо без базы",
    },
    statusTone: "limited",
    stack: ["Next.js 16", "TypeScript", "PostgreSQL", "Supabase Auth", "next-intl", "Zod", "Vitest"],
    demo: "https://barbershop-demo-sable.vercel.app",
    links: [
      { label: { en: "Live site", ru: "Сайт" }, href: "https://barbershop-demo-sable.vercel.app" },
      { label: { en: "Admin demo", ru: "Демо админки" }, href: "https://barbershop-demo-sable.vercel.app/en/demo/admin" },
    ],
    tests: 248,
    limitations: {
      en: [
        "The live site currently runs without its database (the Supabase project is paused): booking is a labelled preview and accounts are unavailable. The admin demo works with invented data.",
        "Real email delivery was not exercised; reminders need an external scheduler on the free plan.",
        "Tested in Chrome only, not on real phones. The security review is a self-review.",
      ],
      ru: [
        "Сейчас сайт работает без базы (проект Supabase на паузе): запись идёт в режиме предпросмотра, аккаунты недоступны. Демо админки работает на вымышленных данных.",
        "Настоящая отправка писем не проверялась; напоминаниям на бесплатном тарифе нужен внешний планировщик.",
        "Проверено только в Chrome, не на настоящих телефонах. Обзор безопасности сделан самостоятельно.",
      ],
    },
    shots: [
      { file: "home.webp", source: "barbershop-demo/docs/screenshots/home.jpg", kind: "desktop", caption: { en: "Front page", ru: "Главная" } },
      { file: "booking.webp", source: "barbershop-demo/docs/screenshots/booking.jpg", kind: "desktop", caption: { en: "Booking: choosing a time", ru: "Запись: выбор времени" } },
      { file: "admin-calendar.webp", source: "barbershop-demo/docs/screenshots/admin-calendar.jpg", kind: "desktop", caption: { en: "Admin calendar", ru: "Календарь администратора" } },
      { file: "admin-analytics.webp", source: "barbershop-demo/docs/screenshots/admin-analytics.jpg", kind: "desktop", caption: { en: "Admin analytics", ru: "Аналитика администратора" } },
      { file: "mobile-booking.webp", source: "barbershop-demo/docs/screenshots/mobile-booking.jpg", kind: "phone", caption: { en: "Booking on a phone", ru: "Запись на телефоне" } },
    ],
  },
  {
    slug: "flowly",
    name: "Flowly",
    folder: "flowly",
    showcase: "flowly",
    kind: { en: "BI dashboard", ru: "BI-дашборд" },
    tagline: {
      en: "Sales analytics for small shops: import orders from CSV or Excel and get revenue, customers, trends and a printable report, or open the full demo without signing up.",
      ru: "Аналитика продаж для небольших магазинов: загрузите заказы из CSV или Excel и получите выручку, клиентов, динамику и отчёт для печати, или откройте демо без регистрации.",
    },
    status: { en: "Completed, deployed", ru: "Завершён, опубликован" },
    statusTone: "live",
    stack: ["Next.js 16", "TypeScript", "Supabase", "PostgreSQL", "Recharts", "shadcn/ui", "Playwright"],
    demo: "https://flowly-nine-ochre.vercel.app/demo",
    links: [
      { label: { en: "Demo workspace", ru: "Демо" }, href: "https://flowly-nine-ochre.vercel.app/demo" },
      { label: { en: "Product site", ru: "Сайт продукта" }, href: "https://flowly-nine-ochre.vercel.app" },
    ],
    tests: 194,
    limitations: {
      en: [
        "Not tested on physical phones or real Safari; WebKit and device emulation stand in for them.",
        "The password-reset email was not followed end to end.",
        "English interface only; texts are prepared for a translation. The security review is a self-review.",
      ],
      ru: [
        "Не проверялся на настоящих телефонах и в настоящем Safari; вместо них WebKit и эмуляция устройств.",
        "Письмо сброса пароля не проверено до конца.",
        "Интерфейс только на английском, тексты подготовлены к переводу. Обзор безопасности сделан самостоятельно.",
      ],
    },
    shots: [
      { file: "overview.webp", source: "flowly/docs/screenshots/overview.jpg", kind: "desktop", caption: { en: "Overview: KPIs, revenue trend, channels", ru: "Обзор: показатели, динамика выручки, каналы" } },
      { file: "analytics.webp", source: "flowly/docs/screenshots/analytics.jpg", kind: "desktop", caption: { en: "Analytics by category", ru: "Аналитика по категориям" } },
      { file: "import-map.webp", source: "flowly/docs/screenshots/import-map.jpg", kind: "desktop", caption: { en: "Import wizard: matching columns", ru: "Мастер импорта: сопоставление колонок" } },
      { file: "report.webp", source: "flowly/docs/screenshots/report.jpg", kind: "desktop", caption: { en: "Printable report", ru: "Отчёт для печати" } },
      { file: "mobile-overview.webp", source: "flowly/docs/screenshots/mobile-overview.jpg", kind: "phone", caption: { en: "Overview on a phone", ru: "Обзор на телефоне" } },
    ],
  },
  {
    slug: "splitly",
    name: "Splitly",
    folder: "splitly",
    showcase: "splitly",
    kind: { en: "Telegram Mini App", ru: "Мини-приложение Telegram" },
    tagline: {
      en: "Shared group expenses inside Telegram: splits in any currency, a receipt scanner that runs on the phone, balances with simplified transfers, reports in PDF, XLSX and CSV.",
      ru: "Общие расходы группы внутри Telegram: деление в любой валюте, сканер чеков прямо на телефоне, балансы с упрощёнными переводами, отчёты PDF, XLSX и CSV.",
    },
    status: { en: "Completed, deployed; full phone checklist pending", ru: "Завершён, опубликован; полная проверка на телефонах впереди" },
    statusTone: "limited",
    stack: ["Next.js 16", "TypeScript", "PostgreSQL", "Telegram Mini Apps", "Tesseract.js", "pdf-lib", "Playwright"],
    demo: "https://splitly-self.vercel.app/en/demo",
    links: [
      { label: { en: "Browser demo", ru: "Демо в браузере" }, href: "https://splitly-self.vercel.app/en/demo" },
      { label: { en: "Open in Telegram", ru: "Открыть в Telegram" }, href: "https://t.me/Splitlly_bot" },
    ],
    tests: 269,
    limitations: {
      en: [
        "Receipt reading is weak on real receipts: prices are found reliably, item names often are not; the review screen and manual entry cover it.",
        "The full device checklist (iOS, Android, desktop Telegram) has not been run; downloads inside Telegram are not checked on real phones.",
        "Screenshots show the Russian interface; the app itself is in English and Russian.",
      ],
      ru: [
        "Чтение реальных чеков слабое: цены находятся надёжно, названия часто нет; выручают экран проверки и ручной ввод.",
        "Полная проверка на устройствах (iOS, Android, Telegram для компьютера) не проводилась; скачивание файлов внутри Telegram на настоящих телефонах не проверено.",
        "На скриншотах русский интерфейс; в приложении есть русский и английский.",
      ],
    },
    shots: [
      { file: "desktop-group.webp", source: "splitly/docs/screenshots/stitch/desktop-group.webp", kind: "desktop", caption: { en: "A group: balance, members, expenses", ru: "Группа: баланс, участники, расходы" } },
      { file: "desktop-dark-analytics.webp", source: "splitly/docs/screenshots/stitch/desktop-dark-analytics.webp", kind: "desktop", caption: { en: "Analytics in the dark theme", ru: "Аналитика в тёмной теме" } },
      { file: "phone-home.webp", source: "splitly/docs/screenshots/stitch/phone-home.webp", kind: "phone", caption: { en: "Home: groups and recent expenses", ru: "Главная: группы и последние расходы" } },
      { file: "phone-scan-2-review.webp", source: "splitly/docs/screenshots/stitch/phone-scan-2-review.webp", kind: "phone", caption: { en: "Receipt scanner: reviewing lines", ru: "Сканер чеков: проверка строк" } },
      { file: "phone-scan-3-assign.webp", source: "splitly/docs/screenshots/stitch/phone-scan-3-assign.webp", kind: "phone", caption: { en: "Receipt scanner: assigning items", ru: "Сканер чеков: распределение позиций" } },
    ],
  },
  {
    slug: "questling",
    name: "Questling",
    folder: "questling",
    showcase: "questling",
    kind: { en: "Learning game in Telegram", ru: "Обучающая игра в Telegram" },
    tagline: {
      en: "An English-learning game in Telegram with a Teacher Studio: story campaigns with clues and choices, quests, a word journal, voice acting; teachers build quests visually and see errors by question.",
      ru: "Игра для изучения английского в Telegram со студией учителя: сюжетные кампании с уликами и выбором, квесты, словарь, озвучка; учитель собирает квесты визуально и видит ошибки по вопросам.",
    },
    status: { en: "Deployed; phone checklist pending", ru: "Опубликован; проверка на телефонах впереди" },
    statusTone: "limited",
    stack: ["Next.js 16", "TypeScript", "Supabase", "PostgreSQL", "Telegram Mini Apps", "S3 storage", "Playwright"],
    demo: "https://questling-dusky.vercel.app/en/demo",
    links: [
      { label: { en: "Student demo", ru: "Демо ученика" }, href: "https://questling-dusky.vercel.app/en/demo" },
      { label: { en: "Teacher Studio demo", ru: "Демо студии учителя" }, href: "https://questling-dusky.vercel.app/en/demo/studio" },
      { label: { en: "Open in Telegram", ru: "Открыть в Telegram" }, href: "https://t.me/QuestlingEnglish_bot" },
    ],
    tests: 205,
    limitations: {
      en: [
        "Not yet tested on physical phones inside Telegram, including voice recording on iPhone and Android.",
        "Password-reset emails for teachers need an SMTP server that is not configured yet.",
        "No automatic pronunciation scoring: teachers review recordings. Team quests and 3D characters are out of scope.",
      ],
      ru: [
        "Ещё не проверялся на настоящих телефонах в Telegram, включая запись голоса на iPhone и Android.",
        "Письмам сброса пароля для учителей нужен почтовый сервер, он ещё не настроен.",
        "Автоматической оценки произношения нет: записи проверяет учитель. Командные квесты и 3D-персонажи вне рамок проекта.",
      ],
    },
    shots: [
      { file: "studio-builder.webp", source: "questling/docs/screenshots/studio-builder.jpg", kind: "desktop", caption: { en: "Teacher Studio: visual quest builder", ru: "Студия учителя: визуальный конструктор квестов" } },
      { file: "studio-analytics.webp", source: "questling/docs/screenshots/studio-analytics.jpg", kind: "desktop", caption: { en: "Teacher Studio: help queue and answers", ru: "Студия учителя: очередь помощи и ответы" } },
      { file: "home.webp", source: "questling/docs/screenshots/home.jpg", kind: "phone", caption: { en: "Student home: hero, chapter, daily quests", ru: "Главная ученика: герой, глава, квесты дня" } },
      { file: "story-player.webp", source: "questling/docs/screenshots/story-player.jpg", kind: "phone", caption: { en: "Story player: a clue question", ru: "Плеер истории: вопрос-улика" } },
      { file: "story-map.webp", source: "questling/docs/screenshots/story-map.jpg", kind: "phone", caption: { en: "Story map", ru: "Карта истории" } },
      { file: "word-journal.webp", source: "questling/docs/screenshots/word-journal.jpg", kind: "phone", caption: { en: "Word journal", ru: "Словарь" } },
    ],
  },
];

export const codeUrl = (p: Project) => `${repo}/${p.folder}`;

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}
