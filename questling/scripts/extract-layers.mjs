// Offline alpha extraction for equipment layers (Gate 4 vertical slice). The Stitch exports sit on a
// dark studio background (flat, or a soft radial gradient) and have no alpha; this cuts the background
// away once, here, into true transparency, so nothing is keyed at runtime. The originals in
// design-source/ are only read; the results go to art/layers/ (masters) for scripts/build-layers.mjs.
//
// How: background is what can be reached from the image border by small steps (neighbouring pixels
// of nearly the same colour, all still dark), so a gradient is followed but a figure's edge stops the
// fill, and dark parts inside a figure (pupils, a cape's dark panels) are never cut. The background
// colour at each point is then estimated from the background around it; on the boundary, alpha ramps
// with the distance from that colour, and the colour is un-mixed from it, so no dark halo is left.
//
// Run: node scripts/extract-layers.mjs   (prints how much became transparent and the figure's box)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const stitch = (folder, n) => path.join(root, "design-source", "stitch-assets", `${folder}${n}`, "screen.png");
const base = "clean_standalone_base_character_model_asset_for_the_dark_fantasy_game_questling_";
const equipment = "clean_standalone_wearable_game_equipment_asset_for_the_dark_fantasy_game_";
const outfit = "clean_standalone_wearable_outfit_asset_for_the_dark_fantasy_game_questling_";

// step: largest colour change between neighbours inside the background; limit: how far from the
// corners' colour the background may get; low/high: the soft edge, as distance from the local background.
export const SOURCES = {
  "cat-base": { file: stitch(base, 4), step: 4, limit: 24, low: 10, high: 34 },
  "witch-hat": { file: stitch(equipment, 2), step: 5, limit: 45, low: 10, high: 34 },
  "star-amulet": { file: stitch(equipment, 5), step: 5, limit: 60, low: 10, high: 34 },
  "ceremonial-cape": { file: stitch(outfit, 3), step: 4, limit: 40, low: 8, high: 26 },
};

const out = path.join(root, "art", "layers");

export async function extract({ file, step, limit, low, high }) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const n = w * h;
  const at = (i, k) => data[i * 3 + k];
  const corners = [2 * w + 2, 2 * w + w - 3, (h - 3) * w + 2, (h - 3) * w + w - 3];
  const ref = [0, 1, 2].map((k) => corners.map((i) => at(i, k)).sort((a, b) => a - b)[1]);
  const far = (i) => Math.hypot(at(i, 0) - ref[0], at(i, 1) - ref[1], at(i, 2) - ref[2]) > limit;

  // 1. Flood the background from the border, by small steps.
  const outside = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const seed = (i) => {
    if (!outside[i] && !far(i)) ((outside[i] = 1), (queue[tail++] = i));
  };
  for (let x = 0; x < w; x++) (seed(x), seed((h - 1) * w + x));
  for (let y = 0; y < h; y++) (seed(y * w), seed(y * w + w - 1));
  const close = (i, j) => Math.abs(at(i, 0) - at(j, 0)) + Math.abs(at(i, 1) - at(j, 1)) + Math.abs(at(i, 2) - at(j, 2)) <= step * 3;
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < n - w ? i + w : -1]) {
      if (j >= 0 && !outside[j] && !far(j) && close(i, j)) ((outside[j] = 1), (queue[tail++] = j));
    }
  }

  // 2. The local background colour: the background blurred, divided by the blurred background mask.
  const weighted = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) weighted[i * 4 + k] = outside[i] ? at(i, k) : 0;
    weighted[i * 4 + 3] = outside[i] ? 255 : 0;
  }
  const blurred = await sharp(weighted, { raw: { width: w, height: h, channels: 4 } })
    .blur(24)
    .raw()
    .toBuffer();
  const local = (i, k) => {
    const m = blurred[i * 4 + 3];
    return m > 2 ? (blurred[i * 4 + k] * 255) / m : ref[k];
  };

  // 3. The boundary band: background pixels and the two-pixel rim of the figure next to them.
  const band = new Uint8Array(outside);
  for (let pass = 0; pass < 2; pass++) {
    const next = new Uint8Array(band);
    for (let i = 0; i < n; i++) {
      if (band[i]) continue;
      const x = i % w;
      if ((x > 0 && band[i - 1]) || (x < w - 1 && band[i + 1]) || (i >= w && band[i - w]) || (i < n - w && band[i + w])) next[i] = 1;
    }
    band.set(next);
  }

  // 4. Islands: specks of shadow cut off from the figure. Only pieces of at least 0.5% of the largest one stay.
  const label = new Int32Array(n).fill(-1);
  const sizes = [];
  for (let s0 = 0; s0 < n; s0++) {
    if (label[s0] !== -1 || outside[s0]) continue;
    const id = sizes.length;
    let count = 0;
    let qh = 0;
    let qt = 0;
    label[s0] = id;
    queue[qt++] = s0;
    while (qh < qt) {
      const i = queue[qh++];
      count++;
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < n - w ? i + w : -1])
        if (j >= 0 && label[j] === -1 && !outside[j]) ((label[j] = id), (queue[qt++] = j));
    }
    sizes.push(count);
  }
  const largest = Math.max(...sizes);
  const keep = sizes.map((size) => size >= largest * 0.005);

  const rgba = Buffer.alloc(n * 4);
  let transparent = 0;
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;
  for (let i = 0; i < n; i++) {
    const bg = [local(i, 0), local(i, 1), local(i, 2)];
    let a = 1;
    if (outside[i] || !keep[label[i]]) a = 0;
    else if (band[i]) {
      const d = Math.hypot(at(i, 0) - bg[0], at(i, 1) - bg[1], at(i, 2) - bg[2]);
      // Whatever the fill reached is background, studio shadows included; only the figure's own rim is soft.
      a = Math.min(1, Math.max(0, (d - low) / (high - low)));
    }
    const o = i * 4;
    for (let k = 0; k < 3; k++) rgba[o + k] = a > 0 ? Math.max(0, Math.min(255, Math.round((at(i, k) - (1 - a) * bg[k]) / a))) : 0;
    rgba[o + 3] = Math.round(a * 255);
    if (rgba[o + 3] === 0) transparent++;
    else if (rgba[o + 3] > 8) {
      const x = i % w;
      const y = (i / w) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return {
    rgba,
    width: w,
    height: h,
    transparent: transparent / n,
    box: { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await mkdir(out, { recursive: true });
  for (const [name, source] of Object.entries(SOURCES)) {
    const result = await extract(source);
    await sharp(result.rgba, { raw: { width: result.width, height: result.height, channels: 4 } })
      .png()
      .toFile(path.join(out, `${name}.png`));
    const meta = { source: path.relative(root, source.file).replace(/\\/g, "/"), size: [result.width, result.height], box: result.box };
    await writeFile(path.join(out, `${name}.json`), JSON.stringify(meta, null, 2) + "\n");
    console.log(`${name}: ${(result.transparent * 100).toFixed(1)}% transparent, figure`, result.box);
  }
}
