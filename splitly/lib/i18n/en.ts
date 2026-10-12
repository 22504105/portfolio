// Every word the interface shows, in English. Russian is ru.ts, of the same
// shape; a test checks that neither is missing a key the other has.

export const en = {
  brand: { name: "Splitly", tagline: "Split smart. Live easy." },
  nav: {
    label: "Main",
    home: "Home",
    groups: "Groups",
    activity: "Activity",
    profile: "Profile",
    add: "Add expense",
    skip: "Skip to content",
    toHome: "Splitly: front page",
  },
  demo: {
    badge: "Demo data",
    note: "Everything here is invented and stays in this browser.",
  },
  onboarding: {
    title: "Share the bill, not the awkwardness",
    lead: "Splitly keeps track of who paid and who owes in a group: a trip, a flat, a dinner. Scan a receipt, give each line to whoever had it, and settle up with the fewest transfers.",
    openDemo: "Try the demo",
    demoHint: "No account. Sample data that stays in your browser.",
    telegram: "Telegram sign-in",
    telegramHint:
      "Splitly runs inside Telegram as a Mini App. Sign-in is built in the next stage; until then the demo shows the app itself.",
    points: [
      {
        title: "Receipts, read on your phone",
        body: "A photo of the receipt is read on the device itself. You check every line before anything is saved; nothing is guessed.",
      },
      {
        title: "Exact to the last kuruş",
        body: "Amounts are never rounded away. When a bill does not divide evenly, a fixed rule decides who gets the extra unit, the same every time.",
      },
      {
        title: "Several currencies, honestly",
        body: "Each expense keeps its own currency and the rate it was converted at. Old totals never move when rates do.",
      },
    ],
    limits: "A portfolio project. Receipt reading is best-effort and translation is a limited word list: you can always correct by hand.",
  },
  home: {
    title: "Home",
    lead: "Your balance across groups, what needs settling, and what happened lately.",
  },
  groups: {
    title: "Groups",
    lead: "Every group you share expenses with: its people, its currency, where you stand.",
  },
  activity: {
    title: "Activity",
    lead: "Who added, changed or settled what, newest first.",
  },
  add: {
    title: "Add expense",
    lead: "Type an expense in, or scan a receipt and give each line to whoever had it.",
  },
  profile: {
    title: "Profile",
    lead: "How Splitly looks and speaks on this device.",
    language: "Language",
    languageHint: "Receipt items keep their original text whatever you choose here.",
    theme: "Theme",
    themeHint: "Kept on this device only.",
  },
  stage: {
    title: "This screen is built in stage {stage}",
    body: "Splitly is being built in five stages. The navigation, both languages and both themes are here now; this screen's content comes next. Nothing is hidden or switched off: it is simply not written yet.",
    plan: "What comes when",
    stages: [
      "Foundation: design, navigation, languages, themes, database design.",
      "Groups, people, invitations and expenses typed in by hand. Telegram sign-in.",
      "Receipt scanner: photo, on-device reading, review, giving lines to people.",
      "Balances, settling up, several currencies, analytics, export.",
      "Telegram polish, accessibility, security review, launch.",
    ],
    current: "now",
  },
  theme: { label: "Theme", light: "Light", dark: "Dark", system: "Same as device", switchTo: "Switch to" },
  language: { label: "Language", en: "English", ru: "Русский" },
  notFound: { title: "Nothing here", body: "This address leads nowhere.", home: "To the front page" },
} as const;

type Shape<T> = T extends string
  ? string
  : T extends readonly (infer Item)[]
    ? readonly Shape<Item>[]
    : { readonly [Key in keyof T]: Shape<T[Key]> };

/** The shape every language must have. */
export type Dictionary = Shape<typeof en>;
