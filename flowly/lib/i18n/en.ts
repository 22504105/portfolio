// Every word the interface shows, in English. A second language is a second
// file of the same shape (`Messages`), chosen in lib/i18n/index.ts.

export const en = {
  brand: {
    name: "flowly.",
    tagline: "Business intelligence, made simple.",
  },
  nav: {
    label: "Workspace",
    open: "Open navigation",
    title: "Navigation",
    overview: "Overview",
    analytics: "Analytics",
    customers: "Customers",
    transactions: "Transactions",
    imports: "Imports",
    reports: "Reports",
    settings: "Settings",
    home: "Flowly home",
    skip: "Skip to content",
  },
  shell: {
    demoWorkspace: "Demo workspace",
    demoNote: "Sample data, read-only",
    tryYourData: "Try your data",
    period: "Period",
    workspace: "Workspace",
  },
  kpi: {
    netRevenue: "Net revenue",
    completedOrders: "Completed orders",
    averageOrder: "Average order value",
    identifiedCustomers: "Identified customers",
    unavailable: "N/A",
    versusPrevious: "vs previous {days} days",
    noComparison: "No earlier period to compare",
    up: "Up",
    down: "Down",
    unchanged: "No change",
    guestOrders: "{count} guest orders are not counted as customers",
  },
  overview: {
    title: "Overview",
    subtitle: "{workspace} · {range}",
    provenanceDemo: "Calculated from {orders} sample orders",
    moreSoon: "Charts, channels, products and recent transactions arrive in the next build phase.",
  },
  building: {
    title: "{section} is being built",
    body: "This page is part of the next build phase. Nothing here is switched off or hidden: it simply is not written yet.",
    back: "Back to Overview",
  },
  landing: {
    heroTitle: "Understand your business. Move with confidence.",
    heroBody:
      "Flowly turns the sales spreadsheet you already have into revenue, orders and customers you can read at a glance. No connectors to set up and nothing to pay.",
    exploreDemo: "Explore live demo",
    createWorkspace: "Create workspace",
    previewLabel: "Live preview of the demo workspace",
    previewCaption: "Live figures from the demo workspace, last 30 days of sample data.",
    featuresTitle: "Built around the numbers you actually use",
    features: [
      {
        title: "One source, every page",
        body: "Every figure, chart and table is calculated from the same orders. Change the dates and everything moves together.",
      },
      {
        title: "Your spreadsheet, as it is",
        body: "Upload a CSV or Excel file, match the columns, fix what is flagged, and confirm. Nothing is guessed silently.",
      },
      {
        title: "Honest about what it knows",
        body: "No traffic data means no conversion rate. Orders without a customer are never passed off as customers.",
      },
    ],
    stepsTitle: "From file to dashboard in four steps",
    steps: [
      { title: "Upload", body: "Drop a CSV or XLSX file of up to 10,000 rows." },
      { title: "Map", body: "Tell Flowly which column is the date, the amount, the customer." },
      { title: "Validate", body: "See every row that will not import, and why." },
      { title: "Confirm", body: "Review the totals, then import. Delete a batch at any time." },
    ],
    privacyTitle: "A free demo, and private data that stays yours",
    privacyBody:
      "The demo runs on invented orders from an invented shop and needs no account. In your own workspace, files are read in your browser and only the rows you confirm are stored, visible to you alone. No tracking, no ads.",
    privacyLink: "Read how data is handled",
    faqTitle: "Questions",
    faq: [
      {
        q: "Is the demo real?",
        a: "The software is real and the figures are calculated live. The shop, its customers and its orders are invented.",
      },
      {
        q: "What does it cost?",
        a: "Nothing. Flowly is a portfolio project built entirely on free tiers, with the limits that come with them.",
      },
      { q: "Which files can I import?", a: "CSV and XLSX, up to 5 MB and 10,000 rows per file. Formulas and macros are never run." },
      { q: "Can I connect Stripe or Google Ads?", a: "No. There are no live integrations, and no buttons pretending there are." },
    ],
    footerNote: "Flowly is a portfolio project. Sample data is fictional.",
    signIn: "Sign in",
    privacy: "Privacy",
  },
  auth: {
    loginTitle: "Sign in",
    signupTitle: "Create your workspace",
    resetTitle: "Reset your password",
    notYet: "Accounts open in a later build phase. Until then the demo shows everything Flowly does, on sample data.",
    toDemo: "Explore the demo",
  },
  privacy: {
    title: "Privacy",
    body: "The full data-handling notes are written together with accounts and imports. Today the site stores nothing about you: the demo runs on invented data, there are no accounts yet, and there is no tracking.",
  },
  notFound: {
    title: "Page not found",
    body: "There is nothing at this address.",
    home: "Go to the front page",
  },
} as const;

type Shape<T> = T extends string
  ? string
  : T extends readonly (infer Item)[]
    ? readonly Shape<Item>[]
    : { readonly [Key in keyof T]: Shape<T[Key]> };

/** The shape every language file must have. */
export type Messages = Shape<typeof en>;
