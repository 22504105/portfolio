// Puts what the receipt scanner needs into public/ocr, so that it is served
// by Splitly itself: the recogniser's worker, its engine, and the reading data
// for Turkish, English and Russian. Nothing about a receipt ever goes to
// another site, and no other site's code runs in the page.
//
// The files come from the pinned packages in node_modules and are not kept
// in the repository (about 21 MB). Runs before `dev` and `build`.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const out = "public/ocr";
const files = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  // The engine in its three builds: the worker picks the fastest one the device supports.
  ...["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"].map((name) => [
    `node_modules/tesseract.js-core/${name}`,
    `core/${name}`,
  ]),
  // The smaller reading data: about 2 to 3 MB a language, loaded only when that language is chosen.
  ...["eng", "tur", "rus"].map((language) => [
    `node_modules/@tesseract.js-data/${language}/4.0.0/${language}.traineddata.gz`,
    `lang/${language}.traineddata.gz`,
  ]),
];

let copied = 0;
for (const [from, to] of files) {
  if (!existsSync(from)) {
    console.error(`ocr-assets: missing ${from}. Run npm install.`);
    process.exit(1);
  }
  const target = join(out, to);
  if (existsSync(target) && statSync(target).size === statSync(from).size) continue;
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(from, target);
  copied++;
}
console.log(`ocr-assets: ${copied === 0 ? "up to date" : `${copied} file(s) copied to ${out}`}`);
