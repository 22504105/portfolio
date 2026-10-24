// Tiles every image of a folder (searched recursively) into one labelled sheet,
// so a whole asset set can be looked at at once.
// Usage: node scripts/contact-sheet.mjs <dir> <out.png> [tile=220]
import { readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [dir, out, tileArg] = process.argv.slice(2);
const tile = Number(tileArg ?? 220);
const label = 18;

async function walk(d) {
  const found = [];
  for (const entry of await readdir(d, { withFileTypes: true })) {
    const full = path.join(d, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full)));
    else if (/\.(png|jpe?g|webp)$/i.test(entry.name)) found.push(full);
  }
  return found.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

const files = await walk(dir);
const cols = Math.min(8, files.length);
const rows = Math.ceil(files.length / cols);
const cell = tile + label;
const composites = [];
for (const [i, file] of files.entries()) {
  const x = (i % cols) * tile;
  const y = Math.floor(i / cols) * cell;
  composites.push({ input: await sharp(file).resize(tile, tile, { fit: "contain", background: "#ff00ff" }).toBuffer(), left: x, top: y });
  const name = path
    .relative(dir, file)
    .replace(/\\/g, "/")
    .replace(/\/screen\.png$/, "")
    .replace(/^.*_(\w+)$/, "$1");
  const text = `${i + 1}: ${name}`.slice(0, 28).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  composites.push({
    input: Buffer.from(
      `<svg width="${tile}" height="${label}"><text x="4" y="13" font-family="Arial" font-size="12" fill="#fff">${text}</text></svg>`,
    ),
    left: x,
    top: y + tile,
  });
}
await sharp({ create: { width: cols * tile, height: rows * cell, channels: 3, background: "#333" } })
  .composite(composites)
  .png()
  .toFile(out);
files.forEach((f, i) => console.log(`${i + 1}\t${path.relative(dir, f)}`));
