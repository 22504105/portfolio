export const langs = ["en", "ru"] as const;
export type Lang = (typeof langs)[number];

export const isLang = (v: string): v is Lang => (langs as readonly string[]).includes(v);

export const contact = {
  telegram: "https://t.me/Maybemol",
  telegramHandle: "@Maybemol",
  email: "evgeniyshade@gmail.com",
  github: "https://github.com/22504105",
  repo: "https://github.com/22504105/portfolio",
};

const en = {
  meta: {
    title: "Evgeniy · Full-Stack Web Developer",
    description:
      "Portfolio of Evgeniy, Full-Stack Web Developer: booking systems, Telegram Mini Apps, dashboards and websites built with Next.js, TypeScript and PostgreSQL.",
  },
  nav: { projects: "Projects", services: "Services", process: "How I work", contact: "Contact", other: "RU", otherLabel: "Русская версия" },
  skip: "Skip to content",
  hero: {
    eyebrow: "Full-Stack Web Developer",
    title: "Hi, I'm Evgeniy.",
    lead: "I build web applications end to end: websites, booking systems, Telegram Mini Apps and dashboards with Next.js, TypeScript and PostgreSQL.",
    role: "Full-Stack Developer responsible for implementing application functionality, integrating frontend and backend components, and testing the resulting software.",
    telegram: "Message on Telegram",
    email: "Send an email",
    projects: "See the projects",
    facts: ["5 projects with live demos", "Open source on GitHub", "English and Russian interfaces"],
  },
  projects: {
    title: "Projects",
    lead: "Five working applications. All are concept projects: the businesses and data are invented, the software is real and running.",
    caseStudy: "Case study",
    demo: "Live demo",
    code: "Code",
    tests: "automated tests",
  },
  services: {
    title: "What I can build for you",
    items: [
      { name: "Business websites and landing pages", text: "Fast, responsive sites that lead visitors to one action, with forms and basic SEO.", example: "nova-residence" },
      { name: "Online booking systems", text: "Services, staff and time slots, confirmations, and an admin workspace for the business.", example: "cut-and-co" },
      { name: "Telegram Mini Apps", text: "Apps that open inside Telegram with sign-in verified on the server and a browser demo.", example: "splitly" },
      { name: "Dashboards and admin panels", text: "KPIs, charts, searchable tables, CSV and Excel import, printable reports.", example: "flowly" },
      { name: "Web app MVPs", text: "The core flow, user accounts, a database with access rules and tests, deployed.", example: "questling" },
    ],
    example: "Example",
  },
  process: {
    title: "How I work",
    steps: [
      { name: "Scope", text: "We agree in writing on what the first version must do." },
      { name: "Build", text: "You see working versions along the way, not only at the end." },
      { name: "Test", text: "Important logic gets automated tests; every button does what it says." },
      { name: "Hand over", text: "You get the code, setup instructions and a deployed application." },
    ],
  },
  cta: {
    title: "Have a project in mind?",
    text: "Tell me what you need, and I'll suggest how to build it.",
    pricing: "Pricing and timelines are discussed individually based on project requirements.",
  },
  footer: { code: "Source code of this site and all projects", role: "Full-Stack Web Developer" },
  detail: {
    back: "All projects",
    type: "Type",
    role: "My role",
    stack: "Technology",
    links: "Links",
    code: "Source code",
    tests: "Automated tests",
    demoNote: "About this demo",
    screenshots: "Screenshots",
    next: "Next project",
    concept: "Concept project: the business and its data are invented.",
  },
  rootTitle: "Choose a language",
};

export type Dict = typeof en;

const ru: Dict = {
  meta: {
    title: "Евгений · Full-Stack веб-разработчик",
    description:
      "Портфолио Евгения, Full-Stack веб-разработчика: системы онлайн-записи, мини-приложения Telegram, дашборды и сайты на Next.js, TypeScript и PostgreSQL.",
  },
  nav: { projects: "Проекты", services: "Услуги", process: "Как я работаю", contact: "Контакты", other: "EN", otherLabel: "English version" },
  skip: "Перейти к содержимому",
  hero: {
    eyebrow: "Full-Stack веб-разработчик",
    title: "Привет, я Евгений.",
    lead: "Делаю веб-приложения целиком: сайты, системы онлайн-записи, мини-приложения Telegram и дашборды на Next.js, TypeScript и PostgreSQL.",
    role: "Full-Stack разработчик, отвечающий за реализацию функциональности приложения, интеграцию фронтенда и бэкенда и тестирование готового программного обеспечения.",
    telegram: "Написать в Telegram",
    email: "Написать на почту",
    projects: "Смотреть проекты",
    facts: ["5 проектов с живыми демо", "Открытый код на GitHub", "Интерфейсы на русском и английском"],
  },
  projects: {
    title: "Проекты",
    lead: "Пять работающих приложений. Все проекты концептуальные: компании и данные вымышлены, программы настоящие и работают.",
    caseStudy: "Кейс",
    demo: "Демо",
    code: "Код",
    tests: "автотестов",
  },
  services: {
    title: "Что могу сделать для вас",
    items: [
      { name: "Сайты и лендинги для бизнеса", text: "Быстрые адаптивные сайты, которые ведут посетителя к заявке, с формами и базовой SEO-разметкой.", example: "nova-residence" },
      { name: "Системы онлайн-записи", text: "Услуги, мастера и свободное время, подтверждения и кабинет администратора.", example: "cut-and-co" },
      { name: "Мини-приложения Telegram", text: "Приложения внутри Telegram с проверкой входа на сервере и демо в браузере.", example: "splitly" },
      { name: "Дашборды и админ-панели", text: "Показатели, графики, таблицы с поиском, импорт CSV и Excel, отчёты для печати.", example: "flowly" },
      { name: "MVP веб-сервиса", text: "Главный сценарий, аккаунты пользователей, база с правилами доступа и тесты, с публикацией.", example: "questling" },
    ],
    example: "Пример",
  },
  process: {
    title: "Как я работаю",
    steps: [
      { name: "Задача", text: "Письменно договариваемся, что должна уметь первая версия." },
      { name: "Разработка", text: "Вы видите рабочие версии по ходу дела, а не только в конце." },
      { name: "Проверка", text: "На важную логику пишутся автотесты; каждая кнопка делает то, что обещает." },
      { name: "Сдача", text: "Вы получаете код, инструкцию по запуску и опубликованное приложение." },
    ],
  },
  cta: {
    title: "Есть задача?",
    text: "Расскажите, что нужно, и я предложу, как это сделать.",
    pricing: "Стоимость и сроки обсуждаются индивидуально, в зависимости от требований проекта.",
  },
  footer: { code: "Исходный код этого сайта и всех проектов", role: "Full-Stack веб-разработчик" },
  detail: {
    back: "Все проекты",
    type: "Тип проекта",
    role: "Моя роль",
    stack: "Технологии",
    links: "Ссылки",
    code: "Исходный код",
    tests: "Автотесты",
    demoNote: "О демо",
    screenshots: "Скриншоты",
    next: "Следующий проект",
    concept: "Концепт-проект: компания и её данные вымышлены.",
  },
  rootTitle: "Выберите язык",
};

export const dict: Record<Lang, Dict> = { en, ru };

/** Russian demos live under /ru/ in the projects that have both languages. */
export function localizeDemo(href: string, lang: Lang) {
  if (lang !== "ru") return href;
  if (href === "https://barbershop-demo-sable.vercel.app") return `${href}/ru`;
  return href.replace("vercel.app/en/", "vercel.app/ru/");
}
