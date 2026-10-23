// Copies the illustrations the app shows from design-source into public/images,
// resized for the largest size they are drawn at (×2 for retina) and saved as WebP.
// The list below is the only way an image gets into the app: every entry names
// its source, so docs/ASSET_AUDIT.md can be checked against it.
// Run: npm run images
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const remote = (id) => path.join(root, "design-source", "remote-assets", `${id}.jpg`);

// name -> [source, width in px at 2x]
const images = {
  "hero-cat-wizard": [remote("7fcd196e09a2"), 512],
  "forgotten-tower": [remote("316ce7a1a59b"), 1376],
  "sealed-letter": [remote("92d312fab547"), 256],
  "rune-spellbook": [remote("a290d89b186d"), 256],
  "shadow-library": [remote("443694f1801e"), 1408],
};

await mkdir(path.join(root, "public", "images"), { recursive: true });
for (const [name, [file, width]] of Object.entries(images)) {
  const out = path.join(root, "public", "images", `${name}.webp`);
  await sharp(file).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toFile(out);
  console.log(`${name}.webp  ${(await stat(out)).size} bytes  <- ${path.relative(root, file)}`);
}
