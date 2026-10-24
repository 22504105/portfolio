// Lists every image under design-source with its size and whether it carries
// an alpha channel, and for PNGs with alpha how much of the picture is really
// transparent. Prints TSV for docs/ASSET_AUDIT.md.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceRoot = path.resolve(import.meta.dirname, "..", "design-source");

async function walk(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full)));
    else if (/\.(png|jpe?g|webp)$/i.test(entry.name)) found.push(full);
  }
  return found;
}

// Corner pixels tell a flat studio background (all four alike) from a scene.
async function describe(file) {
  const image = sharp(await readFile(file));
  const meta = await image.metadata();
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 16) transparent++;
  const px = (x, y) => {
    const o = (y * info.width + x) * 4;
    return [data[o], data[o + 1], data[o + 2]];
  };
  const corners = [px(2, 2), px(info.width - 3, 2), px(2, info.height - 3), px(info.width - 3, info.height - 3)];
  const spread = Math.max(...[0, 1, 2].map((c) => Math.max(...corners.map((p) => p[c])) - Math.min(...corners.map((p) => p[c]))));
  return {
    file: path.relative(sourceRoot, file).replaceAll("\\", "/"),
    size: `${meta.width}x${meta.height}`,
    format: meta.format,
    alpha: meta.hasAlpha,
    transparentPct: ((transparent / (info.width * info.height)) * 100).toFixed(1),
    corner: `#${corners[0].map((v) => v.toString(16).padStart(2, "0")).join("")}`,
    flatBackground: spread < 12,
  };
}

console.log(["file", "size", "format", "alpha", "transparent%", "corner", "flatBackground"].join("\t"));
for (const file of await walk(sourceRoot)) {
  const d = await describe(file);
  console.log([d.file, d.size, d.format, d.alpha, d.transparentPct, d.corner, d.flatBackground].join("\t"));
}
