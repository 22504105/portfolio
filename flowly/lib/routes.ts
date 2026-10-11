// The map of the application. The demo and a signed-in workspace have the same
// sections under different roots, so a link is always built from a root and a
// section, never typed out.

export const SECTIONS = ["overview", "analytics", "customers", "transactions", "imports", "reports", "settings"] as const;
export type Section = (typeof SECTIONS)[number];

/** "/demo" for the public demo, "/app" for a signed-in workspace. */
export type WorkspaceRoot = "/demo" | "/app";

export const sectionHref = (root: WorkspaceRoot, section: Section) => `${root}/${section}` as const;

export function isSection(value: string): value is Section {
  return (SECTIONS as readonly string[]).includes(value);
}

/** The sections in the main part of the sidebar; Settings sits apart at the bottom. */
export const PRIMARY_SECTIONS = SECTIONS.filter((section) => section !== "settings");
