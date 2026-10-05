import type { NavItem } from "./types";

// Each href matches the id of a section on the page.
export const navigation: NavItem[] = [
  { label: "Residences", href: "#residences" },
  { label: "Architecture", href: "#architecture" },
  { label: "Location", href: "#location" },
  { label: "Gallery", href: "#gallery" },
  { label: "Contact", href: "#contact" },
];

export const headerCta: NavItem = {
  label: "Book a Viewing",
  href: "#contact",
};
