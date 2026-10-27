// Checks every external link in the built site (`out/`) and every internal page link and image.
// Run after `npm run build`: `npm run check:links`. Prints the status of each link; exits 1 on a failure.
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const out = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "out");

async function htmlFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith(".html")) found.push(full);
  }
  return found;
}

const external = new Set();
const internal = new Set();
for (const file of await htmlFiles(out)) {
  const html = await readFile(file, "utf8");
  for (const [, url] of html.matchAll(/(?:href|src)="([^"#]+)/g)) {
    if (url.startsWith("http")) external.add(url.replace(/&amp;/g, "&"));
    else if (url.startsWith("/") && !url.startsWith("/_next/")) internal.add(url.split("?")[0]);
  }
}

let failed = 0;
for (const url of [...internal].sort()) {
  const file = path.join(out, url);
  const ok = await stat(url.endsWith("/") ? path.join(file, "index.html") : file).then(() => true, () => false);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${url}`);
}

for (const url of [...external].sort()) {
  let status = "error";
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 portfolio link check" } });
    status = res.status;
  } catch (e) {
    status = e.cause?.code ?? e.message;
  }
  const ok = status === 200;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${status} ${url}`);
}

console.log(`\n${internal.size} internal, ${external.size} external, ${failed} failed`);
process.exit(failed ? 1 : 0);
