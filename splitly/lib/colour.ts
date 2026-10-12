/** "rgb(248, 247, 243)" as "#f8f7f3": Telegram takes colours only in that form. Null for anything that is not an rgb colour. */
export function hexOf(color: string): string | null {
  const parts = /^rgba?\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})/.exec(color);
  if (!parts || parts.slice(1, 4).some((part) => Number(part) > 255)) return null;
  return `#${parts
    .slice(1, 4)
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")}`;
}
