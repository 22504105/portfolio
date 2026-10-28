import type { Lang } from "./i18n";

type Text = Record<Lang, string>;

export type Shot = {
  /** File name in `public/shots/<slug>/`, produced by `npm run sync`. */
  file: string;
  /** Source file, relative to the repository root. */
  source: string;
  kind: "desktop" | "phone";
  /** The same screen with the English interface, shown on the English pages (`<file>-en.webp`). */
  sourceEn?: string;
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
  /** One strong line under the project name. */
  headline: Text;
  tagline: Text;
  stack: string[];
  demo: string;
  links: Link[];
  /** Automated tests passing on 2026-10-27; null when the project has none. */
  tests: number | null;
  /** What the public demo shows, in one or two neutral sentences (checked 2026-10-27). */
  demoNote: Text;
  shots: Shot[];
};

const repo = "https://github.com/22504105/portfolio/tree/main";

export const projects: Project[] = [
  {
    slug: "nova-residence",
    name: "NOVA Residence",
    folder: "nova-residence",
    showcase: "nova-residence",
    kind: { en: "Real-estate website", ru: "Сайт недвижимости" },
    headline: {
      en: "A premium real-estate website that sells the place before the first visit.",
      ru: "Премиальный сайт недвижимости, который продаёт место ещё до первого визита.",
    },
    tagline: {
      en: "A one-page site for a fictional Istanbul development: editorial design, residences with floor plans drawn from data, a full-screen gallery, a location map and a viewing request form.",
      ru: "Одностраничный сайт вымышленного ЖК в Стамбуле: журнальный дизайн, квартиры с планировками из данных, полноэкранная галерея, карта района и форма заявки на показ.",
    },
    stack: ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS 4", "Motion"],
    demo: "https://nova-residence-five.vercel.app",
    links: [{ label: { en: "Live site", ru: "Сайт" }, href: "https://nova-residence-five.vercel.app" }],
    tests: null,
    demoNote: {
      en: "A concept site for a fictional development. The viewing request form shows its validation and confirmation states; in this showcase it does not send requests.",
      ru: "Концепт-сайт вымышленного жилого комплекса. Форма заявки показывает проверку полей и подтверждение; в этой витрине заявки не отправляются.",
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
    kind: { en: "Booking platform", ru: "Платформа онлайн-записи" },
    headline: {
      en: "A booking platform for barbershops: scheduling, staff, client workflows and analytics.",
      ru: "Платформа онлайн-записи для барбершопов: расписание, мастера, клиенты и аналитика.",
    },
    tagline: {
      en: "Online booking with email confirmation, client accounts, barber and admin workspaces, analytics and an installable PWA, in English and Russian. Double booking is prevented at the database level.",
      ru: "Онлайн-запись с подтверждением по почте, кабинеты клиента, мастера и администратора, аналитика и установка как приложение, на русском и английском. Двойная запись исключена на уровне базы данных.",
    },
    stack: ["Next.js 16", "TypeScript", "PostgreSQL", "Supabase Auth", "next-intl", "Zod", "Vitest"],
    demo: "https://barbershop-demo-sable.vercel.app",
    links: [
      { label: { en: "Live site", ru: "Сайт" }, href: "https://barbershop-demo-sable.vercel.app" },
      { label: { en: "Admin demo", ru: "Демо админки" }, href: "https://barbershop-demo-sable.vercel.app/en/demo/admin" },
    ],
    tests: 248,
    demoNote: {
      en: "The public preview uses demonstration data. Live account and booking services are not enabled in this showcase; the admin demo shows the workspaces on invented data.",
      ru: "Публичная версия работает на демонстрационных данных. Аккаунты и настоящая запись в этой витрине не включены; демо админки показывает кабинеты на вымышленных данных.",
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
    headline: {
      en: "Sales analytics for small shops: from an order export to clear, consistent numbers.",
      ru: "Аналитика продаж для небольших магазинов: от выгрузки заказов к понятным и согласованным цифрам.",
    },
    tagline: {
      en: "Import orders from CSV or Excel and get revenue, customers, trends, transactions and a printable report. Every figure comes from one tested metric engine.",
      ru: "Загрузите заказы из CSV или Excel и получите выручку, клиентов, динамику, транзакции и отчёт для печати. Все цифры считает один протестированный движок метрик.",
    },
    stack: ["Next.js 16", "TypeScript", "Supabase", "PostgreSQL", "Recharts", "shadcn/ui", "Playwright"],
    demo: "https://flowly-nine-ochre.vercel.app/demo",
    links: [
      { label: { en: "Demo workspace", ru: "Демо" }, href: "https://flowly-nine-ochre.vercel.app/demo" },
      { label: { en: "Product site", ru: "Сайт продукта" }, href: "https://flowly-nine-ochre.vercel.app" },
    ],
    tests: 194,
    demoNote: {
      en: "The demo workspace uses an invented shop and needs no account. Account sign-up and saved workspaces are not enabled in this showcase.",
      ru: "Демо работает на данных вымышленного магазина и не требует аккаунта. Регистрация и личные рабочие пространства в этой витрине не включены.",
    },
    shots: [
      { file: "overview.webp", source: "flowly/docs/screenshots/overview.jpg", kind: "desktop", caption: { en: "Overview: KPIs, revenue trend, channels", ru: "Обзор: показатели, динамика выручки, каналы" } },
      { file: "overview-dark.webp", source: "flowly/docs/screenshots/overview-dark.jpg", kind: "desktop", caption: { en: "Overview in the dark theme", ru: "Обзор в тёмной теме" } },
      { file: "analytics.webp", source: "flowly/docs/screenshots/analytics.jpg", kind: "desktop", caption: { en: "Analytics by category", ru: "Аналитика по категориям" } },
      { file: "import-map.webp", source: "flowly/docs/screenshots/import-map.jpg", kind: "desktop", caption: { en: "Import wizard: matching columns", ru: "Мастер импорта: сопоставление колонок" } },
      { file: "report.webp", source: "flowly/docs/screenshots/report.jpg", kind: "desktop", caption: { en: "Printable report", ru: "Отчёт для печати" } },
      { file: "mobile-overview.webp", source: "flowly/docs/screenshots/mobile-overview.jpg", kind: "phone", caption: { en: "Overview on a phone", ru: "Обзор на телефоне" } },
      { file: "mobile-overview-dark.webp", source: "flowly/docs/screenshots/mobile-overview-dark.jpg", kind: "phone", caption: { en: "On a phone, dark theme", ru: "На телефоне, тёмная тема" } },
    ],
  },
  {
    slug: "splitly",
    name: "Splitly",
    folder: "splitly",
    showcase: "splitly",
    kind: { en: "Telegram Mini App", ru: "Мини-приложение Telegram" },
    headline: {
      en: "Shared expenses inside Telegram, split fairly to the cent, with a receipt scanner on the phone.",
      ru: "Общие расходы прямо в Telegram, поделённые честно до копейки, со сканером чеков на телефоне.",
    },
    tagline: {
      en: "Splits in any currency with several payers, balances turned into a short list of transfers, receipts read on the phone and split line by line, reports in PDF, XLSX and CSV.",
      ru: "Деление в любой валюте и с несколькими плательщиками, балансы в виде короткого списка переводов, чеки читаются на телефоне и делятся построчно, отчёты PDF, XLSX и CSV.",
    },
    stack: ["Next.js 16", "TypeScript", "PostgreSQL", "Telegram Mini Apps", "Tesseract.js", "pdf-lib", "Playwright"],
    demo: "https://splitly-self.vercel.app/en/demo",
    links: [
      { label: { en: "Browser demo", ru: "Демо в браузере" }, href: "https://splitly-self.vercel.app/en/demo" },
    ],
    tests: 269,
    demoNote: {
      en: "The browser demo runs the same screens on demonstration data and needs no account. The Telegram version's account services are not enabled in this showcase.",
      ru: "Демо в браузере показывает те же экраны на демонстрационных данных и не требует аккаунта. Аккаунты версии для Telegram в этой витрине не включены.",
    },
    shots: [
      { file: "desktop-group.webp", source: "splitly/docs/screenshots/stitch/desktop-group.webp", kind: "desktop", sourceEn: "splitly/docs/screenshots/stitch-en/desktop-group.webp", caption: { en: "A group: balance, members, expenses", ru: "Группа: баланс, участники, расходы" } },
      { file: "desktop-dark-analytics.webp", source: "splitly/docs/screenshots/stitch/desktop-dark-analytics.webp", kind: "desktop", sourceEn: "splitly/docs/screenshots/stitch-en/desktop-dark-analytics.webp", caption: { en: "Analytics in the dark theme", ru: "Аналитика в тёмной теме" } },
      { file: "phone-home.webp", source: "splitly/docs/screenshots/stitch/phone-home.webp", kind: "phone", sourceEn: "splitly/docs/screenshots/stitch-en/phone-home.webp", caption: { en: "Home: groups and recent expenses", ru: "Главная: группы и последние расходы" } },
      { file: "phone-scan-2-review.webp", source: "splitly/docs/screenshots/stitch/phone-scan-2-review.webp", kind: "phone", sourceEn: "splitly/docs/screenshots/stitch-en/phone-scan-2-review.webp", caption: { en: "Receipt scanner: reviewing lines", ru: "Сканер чеков: проверка строк" } },
      { file: "phone-scan-3-assign.webp", source: "splitly/docs/screenshots/stitch/phone-scan-3-assign.webp", kind: "phone", sourceEn: "splitly/docs/screenshots/stitch-en/phone-scan-3-assign.webp", caption: { en: "Receipt scanner: assigning items", ru: "Сканер чеков: распределение позиций" } },
    ],
  },
  {
    slug: "questling",
    name: "Questling",
    folder: "questling",
    showcase: "questling",
    kind: { en: "Learning game in Telegram", ru: "Обучающая игра в Telegram" },
    headline: {
      en: "An English-learning adventure in Telegram, with a studio where teachers build their own quests.",
      ru: "Приключение для изучения английского в Telegram и студия, где учитель собирает свои квесты.",
    },
    tagline: {
      en: "Story campaigns with clues and choices, quests, a word journal and voice acting for students; a visual quest builder, groups and answer analytics for teachers.",
      ru: "Сюжетные кампании с уликами и выбором, квесты, словарь и озвучка для учеников; визуальный конструктор квестов, группы и аналитика ответов для учителя.",
    },
    stack: ["Next.js 16", "TypeScript", "Supabase", "PostgreSQL", "Telegram Mini Apps", "S3 storage", "Playwright"],
    demo: "https://questling-dusky.vercel.app/en/demo",
    links: [
      { label: { en: "Student demo", ru: "Демо ученика" }, href: "https://questling-dusky.vercel.app/en/demo" },
      { label: { en: "Teacher Studio demo", ru: "Демо студии учителя" }, href: "https://questling-dusky.vercel.app/en/demo/studio" },
      { label: { en: "Open in Telegram", ru: "Открыть в Telegram" }, href: "https://t.me/QuestlingEnglish_bot" },
    ],
    tests: 205,
    demoNote: {
      en: "The student and studio demos run on demonstration data and need no account. In Telegram the app signs in with the user's Telegram account and keeps progress on the server.",
      ru: "Демо ученика и студии работают на демонстрационных данных и не требуют аккаунта. В Telegram приложение входит по аккаунту Telegram и хранит прогресс на сервере.",
    },
    shots: [
      { file: "studio-builder.webp", source: "questling/docs/screenshots/studio-builder.jpg", kind: "desktop", caption: { en: "Teacher Studio: visual quest builder", ru: "Студия учителя: визуальный конструктор квестов" } },
      { file: "studio-analytics.webp", source: "questling/docs/screenshots/studio-analytics.jpg", kind: "desktop", caption: { en: "Teacher Studio: help queue and answers", ru: "Студия учителя: очередь помощи и ответы" } },
      { file: "home.webp", source: "questling/docs/screenshots/home.jpg", kind: "phone", caption: { en: "Student home: hero, chapter, daily quests", ru: "Главная ученика: герой, глава, квесты дня" } },
      { file: "story-player.webp", source: "questling/docs/screenshots/story-player.jpg", kind: "phone", caption: { en: "Story player: a clue question", ru: "Плеер истории: вопрос-улика" } },
      { file: "wardrobe.webp", source: "questling/docs/screenshots/wardrobe.jpg", kind: "phone", caption: { en: "Wardrobe: layered equipment on the hero", ru: "Гардероб: экипировка героя слоями" } },
      { file: "story-map.webp", source: "questling/docs/screenshots/story-map.jpg", kind: "phone", caption: { en: "Story map", ru: "Карта истории" } },
      { file: "word-journal.webp", source: "questling/docs/screenshots/word-journal.jpg", kind: "phone", caption: { en: "Word journal", ru: "Словарь" } },
    ],
  },
];

export const codeUrl = (p: Project) => `${repo}/${p.folder}`;

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}
