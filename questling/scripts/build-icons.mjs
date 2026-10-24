// Collects the Material Symbols the app uses and keeps a font with exactly those
// glyphs in public/fonts/material-symbols.woff2. The Stitch screens draw icons
// with this font; serving a subset of the same font keeps the
// icons identical while the page loads a few kilobytes instead of 3 MB, and from
// our own site. Google Fonts cuts the subset (`icon_names`); the result is stored
// with the list it was made for, so builds only go online when the list changes.
//
// An icon is used when a component says <Icon name="…">, or when a type named `…Icon`
// lists names as a string union (icons chosen by data or passed to a component as a prop).
// Run: npm run icons   (also before dev, build and typecheck)
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const fontDir = path.join(root, "public", "fonts");
const fontFile = path.join(fontDir, "material-symbols.woff2");
const listFile = path.join(fontDir, "material-symbols.json");

async function walk(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full)));
    else if (/\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

const wanted = new Set();
for (const dir of ["app", "components", "lib"]) {
  for (const file of await walk(path.join(root, dir))) {
    const code = await readFile(file, "utf8");
    for (const tag of code.matchAll(/<Icon\b[^>]*?>/g)) {
      const name = tag[0].match(/\bname="([a-z0-9_]+)"/)?.[1];
      if (name) wanted.add(name);
      // name={on ? "volume_up" : "volume_off"}: every literal in the expression.
      const expression = tag[0].match(/\bname=\{([^}]*)\}/)?.[1] ?? "";
      for (const literal of expression.matchAll(/"([a-z0-9_]+)"/g)) wanted.add(literal[1]);
    }
    // icon: "lock", icon: boss ? ("military_tech" as const) : ("auto_awesome" as const)
    for (const property of code.matchAll(/\bicon:\s*([^,\n}]+)/g)) {
      for (const literal of property[1].matchAll(/"([a-z0-9_]+)"/g)) wanted.add(literal[1]);
    }
    for (const union of code.matchAll(/type\s+\w*Icon\s*=\s*([^;]+);/g)) {
      for (const name of union[1].matchAll(/"([a-z0-9_]+)"/g)) wanted.add(name[1]);
    }
  }
}

const names = [...wanted].sort();
const previous = await readFile(listFile, "utf8").then(JSON.parse).catch(() => null);
if (previous && JSON.stringify(previous.names) === JSON.stringify(names)) {
  console.log(`${names.length} icons, font up to date`);
  process.exit(0);
}

// Same axes the exports load: optical size 20–48 (Chrome matches it to the font size), weight
// 100–700 (`font-bold` on an icon), both fills; grade 0, the default.
const css = await fetch(
  `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,0&icon_names=${names.join(",")}&display=block`,
  // A modern browser's user agent, so the answer is WOFF2.
  { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36" } },
).then((r) => {
  if (!r.ok) throw new Error(`Google Fonts answered ${r.status}`);
  return r.text();
});
const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
if (!url) throw new Error(`No font URL in:\n${css}`);
const font = Buffer.from(await (await fetch(url)).arrayBuffer());

await mkdir(fontDir, { recursive: true });
await writeFile(fontFile, font);
await writeFile(listFile, JSON.stringify({ source: "Material Symbols Outlined (Apache-2.0), opsz 20..48, wght 100..700, FILL 0..1, GRAD 0", names }, null, 2) + "\n");
console.log(`${names.length} icons -> public/fonts/material-symbols.woff2 (${font.length} bytes)`);
