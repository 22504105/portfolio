import type { NavItem, Stat } from "./types";

export const site = {
  name: "NOVA Residence",
  shortName: "NOVA",
  tagline: "A new perspective on Istanbul living.",
  description:
    "Contemporary residences designed around space, light and the city.",
  location: "Istanbul, Türkiye",
  copyright: "© 2026 NOVA Residence",
  // NOVA Residence is fictional. The disclosure stays visible on the page.
  disclosure: {
    short: "Concept project",
    long: "A concept project — not a real property development.",
  },
} as const;

export const cta = {
  viewing: { label: "Book a Private Viewing", href: "#contact" },
  residences: { label: "Explore Residences", href: "#residences" },
} as const satisfies Record<string, NavItem>;

export const stats: Stat[] = [
  { value: "124", label: "Residences" },
  { value: "2027", label: "Completion" },
  { value: "24/7", label: "Concierge" },
];

// Placeholder destinations: the brand has no real accounts.
export const socialLinks: NavItem[] = [
  { label: "Instagram", href: "https://www.instagram.com/" },
  { label: "LinkedIn", href: "https://www.linkedin.com/" },
];
