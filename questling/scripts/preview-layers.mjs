// Puts each extracted layer (art/layers/*.png) on a checkerboard of light grey and magenta, where both
// a dark halo and a hole show at once, for checking the cut by eye. Writes art/preview/<name>.png.
// Run: node scripts/preview-layers.mjs [name …]   (--grid: on a plain backdrop with a labelled grid of the
// master's pixels, to read split lines and anchors from; written as art/preview/<name>-grid.png)
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "art", "layers");
const out = path.join(root, "art", "preview");
await mkdir(out, { recursive: true });
const grid = process.argv.includes("--grid");
const args = process.argv.slice(2).filter((a) => a !== "--grid");
const names = args.length ? args : (await readdir(dir)).filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4));

function gridLines(width, height) {
  const lines = [];
  for (let v = 0; v <= Math.max(width, height); v += 50) {
    const major = v % 100 === 0;
    const colour = major ? "#e0161b" : "#2aa7e8";
    if (v <= width) lines.push(`<line x1="${v}" y1="0" x2="${v}" y2="${height}" stroke="${colour}" stroke-width="${major ? 2 : 1}"/>`);
    if (v <= height) lines.push(`<line x1="0" y1="${v}" x2="${width}" y2="${v}" stroke="${colour}" stroke-width="${major ? 2 : 1}"/>`);
    if (major && v <= width) lines.push(`<text x="${v + 3}" y="14" font-size="14" fill="#e0161b">${v}</text>`);
    if (major && v <= height && v > 0) lines.push(`<text x="3" y="${v - 3}" font-size="14" fill="#e0161b">${v}</text>`);
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${lines.join("")}</svg>`);
}

export function checker(width, height, s = 32) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><pattern id="p" width="${s * 2}" height="${s * 2}" patternUnits="userSpaceOnUse"><rect width="${s * 2}" height="${s * 2}" fill="#e8e8e8"/><rect width="${s}" height="${s}" fill="#ff3fbf"/><rect x="${s}" y="${s}" width="${s}" height="${s}" fill="#ff3fbf"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`,
  );
}

for (const name of names) {
  const file = path.join(dir, `${name}.png`);
  const { width, height } = await sharp(file).metadata();
  if (grid) {
    await sharp({ create: { width, height, channels: 3, background: "#cfd6dd" } })
      .composite([{ input: file }, { input: gridLines(width, height) }])
      .png()
      .toFile(path.join(out, `${name}-grid.png`));
    console.log(`art/preview/${name}-grid.png`);
    continue;
  }
  const flat = await sharp(checker(width, height))
    .composite([{ input: file }])
    .png()
    .toBuffer();
  await sharp(flat)
    .resize({ width: 640 })
    .toFile(path.join(out, `${name}.png`));
  console.log(`art/preview/${name}.png`);
}
