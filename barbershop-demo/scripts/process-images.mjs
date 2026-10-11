// Turns the raw generated photographs into the site's image set.
// Usage: npm run images -- <folder with 01.png … 16.png>
//
// Writes public/images/**.jpg and data/images.json (sizes and blur
// placeholders). Photographs that are not in the folder yet are skipped, so
// the set can be supplied in parts. The raw folder stays outside the
// repository; only the processed output is committed.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error("Usage: npm run images -- <folder with the raw photographs>");
  process.exit(1);
}

const sources = JSON.parse(readFileSync("data/image-sources.json", "utf8"));
const manifestPath = "data/images.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// One shared grade keeps the set coherent on the black pages: generated
// photographs come out more saturated and more orange than the palette.
const GRADE = { saturation: 0.82, red: 0.98, blue: 1.03 };
const MAX_WIDTH = 1800;
const EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

let done = 0;
const missing = [];

for (const [key, image] of Object.entries(sources)) {
  const input = EXTENSIONS.map((extension) => path.join(sourceDir, `${image.source}.${extension}`)).find(existsSync);
  if (!input) {
    missing.push(`${image.source} (${key})`);
    continue;
  }

  const output = path.join("public/images", `${image.file}.jpg`);
  await mkdir(path.dirname(output), { recursive: true });

  const graded = sharp(input)
    .rotate()
    .resize({ width: image.width ?? MAX_WIDTH, withoutEnlargement: !image.width, kernel: "lanczos3" })
    .modulate({ saturation: GRADE.saturation })
    .recomb([
      [GRADE.red, 0, 0],
      [0, 1, 0],
      [0, 0, GRADE.blue],
    ]);

  const { width, height } = await graded.clone().jpeg({ quality: 86, mozjpeg: true }).toFile(output);
  const blur = await graded.clone().resize({ width: 16 }).jpeg({ quality: 50 }).toBuffer();

  manifest[key] = {
    src: `/images/${image.file}.jpg`,
    width,
    height,
    blur: `data:image/jpeg;base64,${blur.toString("base64")}`,
  };
  done++;
  console.log(`${image.source} -> images/${image.file}.jpg  ${width}x${height}`);
}

// Keys in the order of image-sources.json, so the file diffs cleanly.
const ordered = Object.fromEntries(Object.keys(sources).filter((key) => manifest[key]).map((key) => [key, manifest[key]]));
writeFileSync(manifestPath, `${JSON.stringify(ordered, null, 2)}\n`);

console.log(`\n${done} processed, ${Object.keys(ordered).length} of ${Object.keys(sources).length} in the set.`);
if (missing.length) console.log(`Not supplied yet: ${missing.join(", ")}`);
