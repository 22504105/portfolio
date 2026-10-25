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
  // The cord above the bail, as for the star amulet.
  "moon-pendant": async () => (x, y) => y < 300,
  "forest-hood": async () => {
    // The dark inside of the hood, traced on the master: the face shows through it.
    const opening = [
      [500, 286],
      [560, 292],
      [615, 315],
      [648, 360],
      [662, 420],
      [660, 490],
      [640, 540],
      [600, 570],
      [540, 585],
      [470, 585],
      [420, 565],
      [400, 520],
      [398, 450],
      [405, 380],
      [430, 325],
      [460, 300],
    ];
    return (x, y) => inside(opening, x, y);
  },
  "star-crown": async () => {
    // The far side of the band, above the front band's scalloped top edge: it goes behind the head.
    const edge = [
      [232, 392],
      [262, 470],
      [300, 415],
      [345, 450],
      [400, 505],
      [455, 455],
      [510, 425],
      [565, 455],
      [612, 505],
      [660, 455],
      [712, 412],
      [755, 468],
      [792, 392],
    ];
    const above = [[200, 300], ...edge, [830, 300]];
    return (x, y) => inside(above, x, y);
  },
  // The strap above the bag goes over the shoulder, behind the body.
  satchel: async () => (x, y) => y < 175,
  // The inside of the collar ring (the cape goes round the neck).
  "green-cape": async () => (x, y) => ((x - 450) / 150) ** 2 + ((y - 284) / 26) ** 2 < 1,
};

// Every master: a hero's base (one layer), or an item, split into back and front by SPLITS or, when it
// sits wholly over the hero (glasses, a bow, a held wand, a companion), one front layer.
const BASES = ["cat-base", "boy-base", "girl-base", "fox-base", "owl-base", "forest-base"];
// Which slot each item's art is worn in: the draw order below goes by slot, as lib/content/figure.ts does.
export const ART_SLOT = {
  "witch-hat": "headwear",
  "forest-hood": "headwear",
  "star-crown": "headwear",
  "round-glasses": "face",
  "star-amulet": "neck",
  "moon-pendant": "neck",
  "red-bow": "neck",
  "ceremonial-cape": "outerwear",
  "green-cape": "outerwear",
  "midnight-cloak": "outerwear",
  "violet-robe": "outfit",
  "violet-tunic": "outfit",
  "brown-coat": "outerwear",
  satchel: "back",
  wand: "handheld",
  "crystal-staff": "handheld",
  lantern: "handheld",
  spellbook: "handheld",
  raven: "companion",
  "moon-cat": "companion",
  "fox-cub": "companion",
  owlet: "companion",
  ghost: "companion",
  sprite: "companion",
};

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
  for (const name of BASES) await writeLayer(name, "base", "body", await load(name), () => true);
  for (const item of Object.keys(ART_SLOT)) {
    const master = await load(item);
    if (!SPLITS[item]) {
      await writeLayer(`${item}-front`, item, "front", master, () => true);
      continue;
    }
    const back = await SPLITS[item](master);
    await writeLayer(`${item}-back`, item, "back", master, (x, y) => back(x, y));
    await writeLayer(`${item}-front`, item, "front", master, (x, y) => !back(x, y));
  }
  await writeFile(path.join(root, "lib", "content", "layers.json"), JSON.stringify(manifest, null, 2) + "\n");
}

// ——— The cat's eight looks ———

// Draw order by slot, back to front (the brief: cape_back, body, cape_front, then amulet, hat,
// companion). The same order as lib/content/figure.ts, which draws the app's figure.
export const ORDER = [
  ["back", "outerwear"],
  ["back", "back"],
  ["back", "neck"],
  ["back", "headwear"],
  ["body", "base"],
  ["front", "outfit"],
  ["front", "outerwear"],
  ["front", "back"],
  ["front", "neck"],
  ["front", "face"],
  ["front", "headwear"],
  ["front", "handheld"],
  ["front", "companion"],
];
const [W, H] = rig.canvas;

/** The layer names to draw for a species wearing these items, back to front. */
const stackOf = (species, items) =>
  ORDER.flatMap(([part, slot]) =>
    part === "body" ? [`${species}-base`] : items.filter((item) => ART_SLOT[item] === slot).map((item) => `${item}-${part}`),
  ).filter((name) => manifest[name]);

export async function compose(species, items, fits = rig.fits[species]) {
  const layers = [];
  for (const name of stackOf(species, items)) {
    const { item, box } = manifest[name];
    const fit = item === "base" ? fits.base : fits[item];
    if (!fit) continue;
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

// ——— The other heroes ———

// Held in the left paw (the companion sits on the right of the canvas' free side, to the left).
const LEFT_HAND = new Set(["crystal-staff"]);
const FEET = 1176; // the rig line every hero stands on (the cat's boots)

/**
 * The fits of every hero but the cat, derived from the cat's checked ones: all six share the same
 * chibi body and differ in the head, so each item moves with the anchor its slot hangs from (rig.json
 * "anchors", measured on the masters): headwear with the top and width of the head, glasses with the
 * eyes, held things with the paw, companions with the feet, the rest with the neck and shoulders.
 * rig.json "tweaks" nudge a single item on a single hero (dx, dy in rig px, k a scale factor).
 */
async function deriveFits() {
  const cat = rig.anchors.cat;
  const lift = (a) => FEET - a.feet;
  const at = (a, [x, y]) => [x, y + lift(a)];
  const mid = (e) => [(e[0][0] + e[1][0]) / 2, (e[0][1] + e[1][1]) / 2];
  const span = (e) => Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1]);
  for (const [species, a] of Object.entries(rig.anchors)) {
    if (species === "cat") continue;
    const fits = { base: { x: 0, y: lift(a), scale: 1 } };
    for (const [item, fit] of Object.entries(rig.fits.cat)) {
      if (item === "base") continue;
      const slot = ART_SLOT[item];
      let from, to, k;
      if (slot === "headwear") [from, to, k] = [at(cat, [512, cat.headTop]), at(a, [512, a.headTop]), a.headWidth / cat.headWidth];
      else if (slot === "face") [from, to, k] = [at(cat, mid(cat.eyes)), at(a, mid(a.eyes)), span(a.eyes) / span(cat.eyes)];
      else if (slot === "handheld") {
        const hand = LEFT_HAND.has(item) ? 0 : 1;
        [from, to, k] = [at(cat, cat.paws[hand]), at(a, a.paws[hand]), a.shoulders / cat.shoulders];
      } else if (slot === "companion") [from, to, k] = [[0, FEET], [0, FEET], 1];
      else [from, to, k] = [at(cat, cat.neck), at(a, a.neck), a.shoulders / cat.shoulders];
      // A tweak's scale pivots on the same anchor, so a smaller hat stays centred on the head.
      const t = rig.tweaks?.[species]?.[item] ?? {};
      const kk = k * (t.k ?? 1);
      fits[item] = {
        x: Math.round(to[0] + kk * (fit.x - from[0]) + (t.dx ?? 0)),
        y: Math.round(to[1] + kk * (fit.y - from[1]) + (t.dy ?? 0)),
        scale: Number((kk * fit.scale).toFixed(4)),
      };
    }
    rig.fits[species] = fits;
  }
  await writeFile(path.join(root, "lib", "content", "rig.json"), JSON.stringify(rig, null, 2) + "\n");
  console.log(
    `lib/content/rig.json: fits derived for ${Object.keys(rig.anchors)
      .filter((s) => s !== "cat")
      .join(", ")}`,
  );
}

/** Every fitted item on each hero, one tile each, and the cat's looks that combine slots, for checking by eye. */
async function everyItem() {
  for (const species of Object.keys(rig.fits)) await heroSheet(species);
  await combinations();
}

async function heroSheet(species) {
  const fitted = Object.keys(ART_SLOT).filter((item) => rig.fits[species][item]);
  const tileW = 300;
  const tileH = Math.round((tileW * H) / W);
  const tiles = [];
  for (const item of [null, ...fitted]) {
    const png = await compose(species, item ? [item] : []);
    const shot = await sharp(background(W, H))
      .composite([{ input: png }])
      .png()
      .toBuffer();
    tiles.push(await sharp(shot).resize(tileW, tileH).png().toBuffer());
  }
  const columns = 7;
  const rows = Math.ceil(tiles.length / columns);
  await sharp({ create: { width: tileW * columns, height: tileH * rows, channels: 3, background: "#101016" } })
    .composite(tiles.map((input, i) => ({ input, left: (i % columns) * tileW, top: Math.floor(i / columns) * tileH })))
    .png()
    .toFile(path.join(qaDir, `${species}-every-item.png`));
  console.log(`docs/visual-qa/equipment/${species}-every-item.png (bare + ${fitted.length} items)`);
}

/** Looks that combine every slot, on each hero. */
async function combinations() {
  const combos = [
    ["forest-hood", "round-glasses", "green-cape", "lantern", "fox-cub"],
    ["star-crown", "red-bow", "ceremonial-cape", "crystal-staff", "owlet"],
    ["witch-hat", "round-glasses", "star-amulet", "satchel", "wand", "raven"],
    ["star-crown", "moon-pendant", "spellbook", "ghost"],
    ["witch-hat", "ceremonial-cape", "star-amulet", "crystal-staff", "moon-cat"],
    ["forest-hood", "satchel", "wand"],
  ];
  const tileW = 300;
  const tileH = Math.round((tileW * H) / W);
  const sheet = async (looks, file, columns, species = "cat") => {
    const tiles = [];
    for (const look of looks) {
      const png = await compose(species, look);
      const shot = await sharp(background(W, H))
        .composite([{ input: png }])
        .png()
        .toBuffer();
      tiles.push(await sharp(shot).resize(tileW, tileH).png().toBuffer());
    }
    const rows = Math.ceil(tiles.length / columns);
    await sharp({ create: { width: tileW * columns, height: tileH * rows, channels: 3, background: "#101016" } })
      .composite(tiles.map((input, i) => ({ input, left: (i % columns) * tileW, top: Math.floor(i / columns) * tileH })))
      .png()
      .toFile(path.join(qaDir, file));
  };
  for (const species of Object.keys(rig.fits)) await sheet(combos, `${species}-combinations.png`, 6, species);
  console.log(`docs/visual-qa/equipment/<hero>-combinations.png (${combos.length} looks each)`);
}

/** The cat at three scales, its mantle on the shoulders: why it cannot both cover them and end at the feet. */
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

/**
 * The garments drawn for human proportions, each fitted to the cat twice: by the shoulders (their
 * width matches the cat's) and by the length (neck to hem matches the cat's tunic). Neither works,
 * which is why they are NEEDS_ART_ASSET (docs/ASSET_AUDIT.md). Measured on the masters: the neck's
 * centre, the shoulders' width and the hem.
 */
async function compareGarments() {
  await mkdir(qaDir, { recursive: true });
  const garments = {
    "violet-tunic": { neck: [455, 295], shoulders: 370, hem: 940 },
    "violet-robe": { neck: [448, 262], shoulders: 400, hem: 957 },
    "brown-coat": { neck: [455, 268], shoulders: 380, hem: 930 },
    "midnight-cloak": { neck: [450, 430], shoulders: 420, hem: 995 },
  };
  // The cat on the rig: neck (512, 821), shoulders 300 px wide, its own tunic's hem at y 1056.
  const cat = { neck: [512, 821], shoulders: 300, hem: 1056 };
  const tiles = [];
  for (const [item, g] of Object.entries(garments)) {
    for (const scale of [cat.shoulders / g.shoulders, (cat.hem - cat.neck[1]) / (g.hem - g.neck[1])]) {
      const fits = {
        ...rig.fits.cat,
        [item]: { x: Math.round(cat.neck[0] - g.neck[0] * scale), y: Math.round(cat.neck[1] - g.neck[1] * scale), scale },
      };
      const png = await compose("cat", [item], fits);
      const shot = await sharp(background(W, H))
        .composite([{ input: png }])
        .png()
        .toBuffer();
      tiles.push(await sharp(shot).resize(300).png().toBuffer());
    }
  }
  const tileH = Math.round((300 * H) / W);
  await sharp({ create: { width: 300 * 8, height: tileH, channels: 3, background: "#101016" } })
    .composite(tiles.map((input, i) => ({ input, left: i * 300, top: 0 })))
    .png()
    .toFile(path.join(qaDir, "cat-garments-fit.png"));
  console.log("docs/visual-qa/equipment/cat-garments-fit.png (per garment: by shoulders, by length)");
}

/** Composes looks given as "item+item" (and optional fits as JSON) to art/preview/try/, to fit by eye. */
async function tryLooks(looks, extraFits) {
  const dir = path.join(root, "art", "preview", "try");
  await mkdir(dir, { recursive: true });
  const fits = { ...rig.fits.cat, ...extraFits };
  for (const look of looks) {
    const png = await compose("cat", look.split("+"), fits);
    await sharp(background(W, H))
      .composite([{ input: png }])
      .png()
      .toFile(path.join(dir, `${look}.png`));
  }
  console.log(`art/preview/try/: ${looks.join(", ")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tryAt = process.argv.indexOf("--try");
  if (tryAt >= 0) {
    manifest = JSON.parse(await readFile(path.join(root, "lib", "content", "layers.json"), "utf8"));
    const fitsArg = process.argv.indexOf("--fits");
    const extra = fitsArg >= 0 ? JSON.parse(await readFile(process.argv[fitsArg + 1], "utf8")) : {};
    await tryLooks(
      process.argv.slice(tryAt + 1).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--fits"),
      extra,
    );
  } else if (process.argv.includes("--compare-garments")) {
    manifest = JSON.parse(await readFile(path.join(root, "lib", "content", "layers.json"), "utf8"));
    await compareGarments();
  } else if (process.argv.includes("--compare-cape")) {
    manifest = JSON.parse(await readFile(path.join(root, "lib", "content", "layers.json"), "utf8"));
    await compareCape();
  } else {
    await build();
    await deriveFits();
    await eightLooks();
    await everyItem();
  }
}
