// Copies the case studies from `showcase/` into `content/` and turns the selected project
// screenshots into web-sized WebP files in `public/shots/`. Run after a case study or a screenshot
// changes: `npm run sync`. The results are committed, so the site builds on its own.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repo = path.dirname(site);

// The project list lives in TypeScript; read the few fields needed here without a TS toolchain.
const source = await readFile(path.join(site, "lib/projects.ts"), "utf8");
const slugs = [];
const shots = [];
for (const m of source.matchAll(/showcase: "([^"]+)"|file: "([^"]+)", source: "([^"]+)", kind: "(desktop|phone)"/g)) {
  if (m[1]) slugs.push(m[1]);
  else shots.push({ slug: slugs.at(-1), file: m[2], src: m[3], kind: m[4] });
}

for (const slug of slugs) {
  await mkdir(path.join(site, "content", slug), { recursive: true });
  for (const lang of ["en", "ru"]) {
    const md = await readFile(path.join(repo, "showcase", slug, `case-study.${lang}.md`), "utf8");
    await writeFile(path.join(site, "content", slug, `${lang}.md`), md.replace(/\r\n/g, "\n"));
  }
}
console.log(`case studies: ${slugs.length * 2}`);

const sizes = {};
for (const { slug, file, src, kind } of shots) {
  const out = path.join(site, "public/shots", slug, file);
  await mkdir(path.dirname(out), { recursive: true });
  const info = await sharp(path.join(repo, src))
    .resize({ width: kind === "desktop" ? 1600 : 640, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(out);
  sizes[`${slug}/${file}`] = [info.width, info.height];
}
// Image sizes for width/height attributes, so the layout does not jump while images load.
await writeFile(path.join(site, "content/shots.json"), JSON.stringify(sizes, null, 2) + "\n");
console.log(`screenshots: ${Object.keys(sizes).length}`);
