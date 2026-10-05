// Turns the raw generated renders into the site's image set in public/images.
// Usage: npm run images -- <folder with 01.png … 19.png>
// The raw folder stays outside the repository; only the processed output is committed.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error("Usage: npm run images -- <folder with the raw renders>");
  process.exit(1);
}

const outputDir = path.resolve("public/images");

// One shared grade keeps the set coherent: the renders are warmer and more
// saturated than the palette they sit in, so saturation comes down and the
// orange cast is eased slightly. `saturation` overrides it for outliers.
const GRADE = { saturation: 0.86, red: 0.985, blue: 1.03 };

// `width` upscales the two hero frames, which are shown full-bleed.
const IMAGES = [
  { source: "01", output: "hero/hero-desktop", width: 2560 },
  { source: "19", output: "hero/hero-mobile", width: 1440, saturation: 0.78 },
  { source: "03", output: "intro/light-study" },
  { source: "04", output: "residences/one-bedroom" },
  { source: "08", output: "residences/two-bedroom" },
  { source: "05", output: "residences/three-bedroom" },
  { source: "02", output: "architecture/terraces" },
  { source: "17", output: "architecture/entrance" },
  { source: "13", output: "amenities/pool" },
  { source: "12", output: "amenities/fitness" },
  { source: "10", output: "amenities/concierge" },
  { source: "11", output: "amenities/lounge" },
  { source: "14", output: "amenities/gardens" },
  { source: "18", output: "location/bosphorus" },
  { source: "15", output: "gallery/exterior-dusk" },
  { source: "06", output: "gallery/bedroom" },
  { source: "07", output: "gallery/terrace-dining" },
  { source: "16", output: "gallery/terrace-lounge" },
  { source: "09", output: "gallery/bathroom" },
];

for (const image of IMAGES) {
  const input = path.join(sourceDir, `${image.source}.png`);
  const output = path.join(outputDir, `${image.output}.jpg`);
  await mkdir(path.dirname(output), { recursive: true });

  let pipeline = sharp(input);
  if (image.width) {
    pipeline = pipeline
      .resize({ width: image.width, kernel: "lanczos3" })
      .sharpen({ sigma: 0.6 });
  }

  const { width, height } = await pipeline
    .modulate({ saturation: image.saturation ?? GRADE.saturation })
    .recomb([
      [GRADE.red, 0, 0],
      [0, 1, 0],
      [0, 0, GRADE.blue],
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(output);

  console.log(`${image.source} -> images/${image.output}.jpg  ${width}x${height}`);
}
