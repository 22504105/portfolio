// Downloads every remote image referenced by the Stitch HTML exports into
// design-source/remote-assets, so the design no longer depends on Stitch's
// temporary googleusercontent links. The bare link serves a 512px preview;
// "=s0" asks for the original size. Writes remote-assets/index.json: one entry
// per unique URL with the local file, its size, the screens that use it and,
// when the same bytes already ship in one of the archives, that archive file.
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceRoot = path.resolve(import.meta.dirname, "..", "design-source");
const root = path.join(sourceRoot, "questling-v2");
const outDir = path.join(sourceRoot, "remote-assets");

async function walk(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full)));
    else found.push(full);
  }
  return found;
}

const sha = (buf) => createHash("sha256").update(buf).digest("hex");

// PNG: width/height/colour type from IHDR (4 and 6 carry alpha). JPEG: SOF marker.
function imageInfo(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    const colorType = buf[25];
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), alpha: colorType === 4 || colorType === 6 };
  }
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5), alpha: false };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return { width: null, height: null, alpha: null };
}

const extByType = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

const archived = new Map();
for (const file of await walk(sourceRoot)) {
  if (file.startsWith(outDir) || !/\.(png|jpe?g|webp)$/i.test(file)) continue;
  archived.set(sha(await readFile(file)), path.relative(sourceRoot, file).replaceAll("\\", "/"));
}

const usage = new Map();
for (const file of (await walk(root)).filter((f) => path.basename(f) === "code.html")) {
  const html = await readFile(file, "utf8");
  const screen = path.relative(root, path.dirname(file)).replaceAll("\\", "/");
  for (const match of html.matchAll(/https:\/\/lh3\.googleusercontent\.com\/[^"'\s)]+/g)) {
    const url = match[0].replaceAll("&amp;", "&");
    if (!usage.has(url)) usage.set(url, new Set());
    usage.get(url).add(screen);
  }
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
const index = [];
for (const [url, screens] of usage) {
  const id = sha(url).slice(0, 12);
  const entry = { id, url, screens: [...screens].sort(), file: null, contentType: null, bytes: 0, width: null, height: null, alpha: null, sameAsArchive: null, error: null };
  try {
    const res = await fetch(`${url}=s0`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = (res.headers.get("content-type") ?? "").split(";")[0];
    const bytes = Buffer.from(await res.arrayBuffer());
    Object.assign(entry, imageInfo(bytes));
    entry.file = `${id}.${extByType[type] ?? "bin"}`;
    entry.contentType = type;
    entry.bytes = bytes.length;
    entry.sameAsArchive = archived.get(sha(bytes)) ?? null;
    await writeFile(path.join(outDir, entry.file), bytes);
  } catch (err) {
    entry.error = String(err.message ?? err);
  }
  index.push(entry);
  console.log(`${entry.error ? "FAIL" : "ok  "} ${id} ${entry.width}x${entry.height} alpha=${entry.alpha} ${entry.sameAsArchive ? `= ${entry.sameAsArchive}` : "(not in archives)"}`);
}
await writeFile(path.join(outDir, "index.json"), JSON.stringify(index, null, 2));
console.log(`\n${index.length} unique URLs, ${index.filter((e) => e.error).length} failed, ${index.filter((e) => e.sameAsArchive).length} already in the archives`);
