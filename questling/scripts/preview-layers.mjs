// Puts each extracted layer (art/layers/*.png) on a checkerboard of light grey and magenta, where both
// a dark halo and a hole show at once, for checking the cut by eye. Writes art/preview/<name>.png.
// Run: node scripts/preview-layers.mjs [name …]
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "art", "layers");
const out = path.join(root, "art", "preview");
await mkdir(out, { recursive: true });
const names = process.argv.slice(2).length
  ? process.argv.slice(2)
  : (await readdir(dir)).filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4));

export function checker(width, height, s = 32) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><pattern id="p" width="${s * 2}" height="${s * 2}" patternUnits="userSpaceOnUse"><rect width="${s * 2}" height="${s * 2}" fill="#e8e8e8"/><rect width="${s}" height="${s}" fill="#ff3fbf"/><rect x="${s}" y="${s}" width="${s}" height="${s}" fill="#ff3fbf"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`,
  );
}

for (const name of names) {
  const file = path.join(dir, `${name}.png`);
  const { width, height } = await sharp(file).metadata();
  const flat = await sharp(checker(width, height))
    .composite([{ input: file }])
    .png()
    .toBuffer();
  await sharp(flat)
    .resize({ width: 640 })
    .toFile(path.join(out, `${name}.png`));
  console.log(`art/preview/${name}.png`);
}
