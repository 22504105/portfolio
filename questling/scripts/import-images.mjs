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
// The standalone exports (stitch-assets), identified by eye from a contact sheet: see docs/ASSET_AUDIT.md.
const stitch = (kind, n) => {
  const folders = {
    base: "clean_standalone_base_character_model_asset_for_the_dark_fantasy_game_questling_",
    companion: "clean_standalone_individual_collectible_companion_pet_asset_for_the_dark_",
    equipment: "clean_standalone_wearable_game_equipment_asset_for_the_dark_fantasy_game_",
    outfit: "clean_standalone_wearable_outfit_asset_for_the_dark_fantasy_game_questling_",
  };
  return path.join(root, "design-source", "stitch-assets", `${folders[kind]}${n}`, "screen.png");
};

// name -> [source, width in px at 2x, optional crop of the source first]
const images = {
  "hero-cat-wizard": [remote("7fcd196e09a2"), 512],
  "forgotten-tower": [remote("316ce7a1a59b"), 1376],
  "sealed-letter": [remote("92d312fab547"), 256],
  "rune-spellbook": [remote("a290d89b186d"), 256],
  "shadow-library": [remote("443694f1801e"), 1408],
  "grand-library": [remote("4b34593af1d6"), 1000],
  "rune-chest": [remote("d34d9e5f738a"), 1408],
  "glowing-chest": [remote("f31dae9d1f10"), 400],
  "crystal-casket": [remote("52bfe43014ee"), 256],
  // Gate 3 story scenes: the clean illustrations of the story library and group management screens.
  forest: [remote("3c813b951c2c"), 1408],
  "forest-spirit": [remote("b8c20053a68a"), 1408],
  // Cropped: the export has a window title bar and frame painted around the picture.
  "archive-mage": [remote("7da39dcc0e1f"), 1376, { left: 16, top: 30, width: 1376, height: 722 }],

  // The six starting characters: plain base models, full body, on the studio background.
  "characters/boy": [stitch("base", 1), 640],
  "characters/girl": [stitch("base", 2), 640],
  "characters/fox": [stitch("base", 3), 640],
  "characters/cat": [stitch("base", 4), 640],
  "characters/owl": [stitch("base", 5), 640],
  "characters/forest": [stitch("base", 6), 640],

  // Item pictures for cards and thumbnails. Not equip layers: no alpha (see ASSET_AUDIT.md).
  "items/forest-hood": [stitch("equipment", 1), 320],
  "items/wizard-hat": [stitch("equipment", 2), 320],
  "items/round-glasses": [stitch("equipment", 3), 320],
  "items/satchel": [stitch("equipment", 4), 320],
  "items/star-amulet": [stitch("equipment", 5), 320],
  "items/spellbook": [stitch("equipment", 6), 320],
  "items/wand": [stitch("equipment", 7), 320],
  "items/red-bow": [stitch("equipment", 8), 320],
  "items/lantern": [stitch("equipment", 9), 320],
  "items/crystal-staff": [stitch("equipment", 10), 320],
  "items/star-crown": [stitch("equipment", 11), 320],
  "items/moon-pendant": [stitch("equipment", 12), 320],
  "items/violet-robe": [stitch("outfit", 1), 320],
  "items/green-cape": [stitch("outfit", 2), 320],
  "items/sunset-cloak": [stitch("outfit", 3), 320],
  "items/violet-tunic": [stitch("outfit", 4), 320],
  "items/brown-coat": [stitch("outfit", 5), 320],
  "items/midnight-cloak": [stitch("outfit", "moon"), 320],
  "items/raven": [stitch("companion", 1), 320],
  "items/moon-cat": [stitch("companion", 2), 320],
  "items/sprite": [stitch("companion", 3), 320],
  "items/fox-cub": [stitch("companion", 4), 320],
  "items/owlet": [stitch("companion", 5), 320],
  "items/ghost": [stitch("companion", 6), 320],
};

for (const [name, [file, width, crop]] of Object.entries(images)) {
  const out = path.join(root, "public", "images", `${name}.webp`);
  await mkdir(path.dirname(out), { recursive: true });
  const source = crop ? sharp(file).extract(crop) : sharp(file);
  await source.resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toFile(out);
  console.log(`${name}.webp  ${(await stat(out)).size} bytes  <- ${path.relative(root, file)}`);
}
