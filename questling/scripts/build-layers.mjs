// Splits the extracted masters (art/layers, scripts/extract-layers.mjs) into the layers a hero wears,
// crops each to its content, and writes them for the app: public/images/layers/<layer>.webp plus
// lib/content/layers.json (each layer's item, part and box on its master). Then it composes every
// combination of the cat's vertical slice (hat, cape, amulet: 8 looks) with the fits of
// lib/content/rig.json, to docs/visual-qa/equipment/, at the rig's full size and at phone sizes.
//
// Splits (all on the item's own 1024-px master; see docs/ASSET_AUDIT.md, "Equipment layers"):
//   witch-hat      back = the dark inside under the brim (behind the head); front = crown and brim.
//   ceremonial-cape back = the collar and the red lining (behind the body); front = mantle, clasp and
//                   the two dark front panels with their gold trim.
//   star-amulet    back = the cord above the bail (it goes under the collar); front = bail and disc.
// Run: node scripts/build-layers.mjs   (or with --compare-cape: the cape at three scales, side by side)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const masters = path.join(root, "art", "layers");
const publicDir = path.join(root, "public", "images", "layers");
const qaDir = path.join(root, "docs", "visual-qa", "equipment");
const rig = JSON.parse(await readFile(path.join(root, "lib", "content", "rig.json"), "utf8"));

const load = async (name) => {
  const { data, info } = await sharp(path.join(masters, `${name}.png`))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};

/** Point-in-polygon, for hand-drawn split lines (coordinates on the master). */
function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// Which pixels of a master go to its back part. The rest is the front part.
const SPLITS = {
  "witch-hat": async () => {
    // The opening under the brim, traced on the master (where its brightness drops below ~40).
    const opening = [
      [352, 628],
      [420, 624],
      [505, 622],
      [590, 624],
      [656, 632],
      [672, 660],
      [676, 700],
      [664, 745],
      [645, 780],
      [610, 800],
      [560, 815],
      [505, 822],
      [450, 815],
      [400, 800],
      [370, 780],
      [345, 745],
      [330, 700],
      [334, 660],
    ];
    // Grown by 3 px, so the opening's dark antialiased rim stays behind the head too.
    return (x, y) =>
      [
        [0, 0],
        [3, 0],
        [-3, 0],
        [0, 3],
        [0, -3],
      ].some(([dx, dy]) => inside(opening, x + dx, y + dy));
  },
  "ceremonial-cape": async ({ data, width, height }) => {
    // Red lining: strongly red, not the orange gold of the trim; the clasp's rubies stay in front.
    const red = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const [r, g, b] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
      red[i] = r > 45 && r > g * 1.8 && r > b * 1.35 ? 255 : 0;
    }
    // A slightly blurred mask, so the boundary follows the folds instead of single pixels.
    const smooth = await sharp(Buffer.from(red), { raw: { width, height, channels: 1 } })
      .blur(1.5)
      .extractChannel(0)
      .raw()
      .toBuffer();
    const clasp = [
      [352, 360],
      [545, 360],
      [545, 480],
      [352, 480],
    ];
    const collar = [
      [312, 270],
      [330, 248],
      [450, 240],
      [575, 248],
      [592, 272],
      [575, 300],
      [520, 318],
      [498, 344],
      [450, 352],
      [402, 344],
      [380, 318],
      [328, 300],
    ];
    // The collar's outline grown by 4 px, so its antialiased rim goes behind the head too.
    const inCollar = (x, y) =>
      [
        [0, 0],
        [4, 0],
        [-4, 0],
        [0, 4],
        [0, -4],
        [3, 3],
        [-3, 3],
        [3, -3],
        [-3, -3],
      ].some(([dx, dy]) => inside(collar, x + dx, y + dy));
    // The lining between the two inner gold trims, as a whole: its lower part is too dark to tell by colour.
    const opening = [
      [408, 482],
      [492, 482],
      [512, 600],
      [534, 720],
      [548, 846],
      [450, 856],
      [352, 846],
      [366, 720],
      [388, 600],
    ];
    return (x, y) => inCollar(x, y) || inside(opening, x, y) || (!inside(clasp, x, y) && smooth[y * width + x] > 127);
  },
  "star-amulet": async () => (x, y) => y < 262,
};

const ITEMS = { "cat-base": null, "witch-hat": "witch-hat", "ceremonial-cape": "ceremonial-cape", "star-amulet": "star-amulet" };

let manifest = {};

async function writeLayer(name, item, part, master, keep) {
  const { data, width, height } = master;
  const out = Buffer.from(data);
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!keep(x, y)) out[i + 3] = 0;
      if (out[i + 3] > 4) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  const box = [minX, minY, maxX - minX + 1, maxY - minY + 1];
  await sharp(out, { raw: { width, height, channels: 4 } })
    .extract({ left: box[0], top: box[1], width: box[2], height: box[3] })
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toFile(path.join(publicDir, `${name}.webp`));
  manifest[name] = { item, part, box };
  console.log(`layers/${name}.webp  box ${box.join(",")}`);
}

async function build() {
  await mkdir(publicDir, { recursive: true });
  manifest = {};
  for (const [name, item] of Object.entries(ITEMS)) {
    const master = await load(name);
    if (!item) {
      await writeLayer(name, "base", "body", master, () => true);
      continue;
    }
    const back = await SPLITS[item](master);
    await writeLayer(`${item}-back`, item, "back", master, (x, y) => back(x, y));
    await writeLayer(`${item}-front`, item, "front", master, (x, y) => !back(x, y));
  }
  await writeFile(path.join(root, "lib", "content", "layers.json"), JSON.stringify(manifest, null, 2) + "\n");
}

// ——— The cat's eight looks ———

// Draw order, back to front (the brief: cape_back, body, cape_front, then amulet, hat, companion).
const ORDER = [
  "ceremonial-cape-back",
  "star-amulet-back",
  "witch-hat-back",
  "cat-base",
  "ceremonial-cape-front",
  "star-amulet-front",
  "witch-hat-front",
];
const [W, H] = rig.canvas;

export async function compose(species, items, fits = rig.fits[species]) {
  const layers = [];
  for (const name of ORDER) {
    const { item, box } = manifest[name];
    if (item !== "base" && !items.includes(item)) continue;
    const fit = item === "base" ? fits.base : fits[item];
    const width = Math.max(1, Math.round(box[2] * fit.scale));
    const height = Math.max(1, Math.round(box[3] * fit.scale));
    const input = await sharp(path.join(publicDir, `${name}.webp`))
      .resize(width, height)
      .png()
      .toBuffer();
    layers.push({ input, left: Math.round(fit.x + box[0] * fit.scale), top: Math.round(fit.y + box[1] * fit.scale) });
  }
  // Layers may hang over the canvas edge; sharp composites only what fits, so place on a padded canvas.
  const pad = 400;
  const canvas = sharp({ create: { width: W + pad * 2, height: H + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  const full = await canvas
    .composite(layers.map((l) => ({ ...l, left: l.left + pad, top: l.top + pad })))
    .png()
    .toBuffer();
  return sharp(full).extract({ left: pad, top: pad, width: W, height: H }).png().toBuffer();
}

const background = (w, h) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#1C1B27"/></svg>`);

async function eightLooks() {
  await mkdir(qaDir, { recursive: true });
  const slice = ["witch-hat", "ceremonial-cape", "star-amulet"];
  const looks = [];
  for (let mask = 0; mask < 8; mask++) looks.push(slice.filter((_, i) => mask & (1 << i)));
  const tiles = [];
  for (const look of looks) {
    const name = look.length ? look.join("+") : "bare";
    const png = await compose("cat", look);
    const shot = await sharp(background(W, H))
      .composite([{ input: png }])
      .png()
      .toBuffer();
    await sharp(shot).toFile(path.join(qaDir, `cat-${name}.png`));
    tiles.push(shot);
  }
  const tileW = 320;
  const tileH = Math.round((tileW * H) / W);
  const sheet = await Promise.all(tiles.map((shot) => sharp(shot).resize(tileW, tileH).png().toBuffer()));
  await sharp({ create: { width: tileW * 4, height: tileH * 2, channels: 3, background: "#101016" } })
    .composite(sheet.map((input, i) => ({ input, left: (i % 4) * tileW, top: Math.floor(i / 4) * tileH })))
    .png()
    .toFile(path.join(qaDir, "cat-eight-looks.png"));
  // The full look on a light checkerboard, where a dark halo or a hole would show.
  const full = await compose("cat", slice);
  const s = 24;
  const checker = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><pattern id="p" width="${s * 2}" height="${s * 2}" patternUnits="userSpaceOnUse"><rect width="${s * 2}" height="${s * 2}" fill="#f4f4f4"/><rect width="${s}" height="${s}" fill="#ff3fbf"/><rect x="${s}" y="${s}" width="${s}" height="${s}" fill="#ff3fbf"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`,
  );
  await sharp(checker)
    .composite([{ input: full }])
    .png()
    .toFile(path.join(qaDir, "cat-full-on-checker.png"));
  console.log(`docs/visual-qa/equipment/: ${tiles.length} looks, cat-eight-looks.png, cat-full-on-checker.png`);
}

/** The cape at three scales, its mantle on the shoulders: why it cannot both cover them and end at the feet. */
async function compareCape() {
  await mkdir(qaDir, { recursive: true });
  const tiles = [];
  for (const scale of [0.8, 0.7, 0.6]) {
    const fits = { ...rig.fits.cat, "ceremonial-cape": { x: Math.round(512 - 450 * scale), y: Math.round(816 - 345 * scale), scale } };
    const png = await compose("cat", ["ceremonial-cape"], fits);
    tiles.push(
      await sharp(
        await sharp(background(W, H))
          .composite([{ input: png }])
          .png()
          .toBuffer(),
      )
        .resize(400)
        .png()
        .toBuffer(),
    );
  }
  await sharp({ create: { width: 1200, height: 500, channels: 3, background: "#101016" } })
    .composite(tiles.map((input, i) => ({ input, left: i * 400, top: 0 })))
    .png()
    .toFile(path.join(qaDir, "cat-cape-scales.png"));
  console.log("docs/visual-qa/equipment/cat-cape-scales.png (0.8, 0.7, 0.6)");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--compare-cape")) {
    manifest = JSON.parse(await readFile(path.join(root, "lib", "content", "layers.json"), "utf8"));
    await compareCape();
  } else {
    await build();
    await eightLooks();
  }
}
