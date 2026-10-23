// Reads the inline `tailwind.config = {...}` of every Stitch screen and reports,
// per theme key (colors, fontFamily, fontSize, borderRadius, spacing, boxShadow),
// which names are defined with different values on different screens.
// Also lists the font families each screen loads from Google Fonts.
// Usage: node scripts/extract-tokens.mjs [--json out.json]
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..", "design-source", "questling-v2");

async function walk(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full)));
    else if (entry.name === "code.html") found.push(full);
  }
  return found.sort();
}

const defs = {}; // section -> name -> value(json) -> [screens]
const fonts = {};
for (const file of await walk(root)) {
  const screen = path.relative(root, path.dirname(file)).replaceAll("\\", "/");
  const html = await readFile(file, "utf8");
  fonts[screen] = [...new Set([...html.matchAll(/family=([A-Za-z+]+)/g)].map((m) => m[1].replaceAll("+", " ")))];
  const script = html.match(/tailwind\.config\s*=\s*([\s\S]*?)<\/script>/);
  if (!script) continue;
  const sandbox = { tailwind: {} };
  try {
    vm.runInNewContext(`tailwind.config = ${script[1]}`, sandbox);
  } catch (err) {
    console.error(`! ${screen}: ${err.message}`);
    continue;
  }
  const extend = sandbox.tailwind.config?.theme?.extend ?? {};
  for (const [section, values] of Object.entries(extend)) {
    const flat = {};
    const flatten = (obj, prefix) => {
      for (const [k, v] of Object.entries(obj)) {
        const name = k === "DEFAULT" ? prefix : prefix ? `${prefix}-${k}` : k;
        if (v && typeof v === "object" && !Array.isArray(v) && section === "colors") flatten(v, name);
        else flat[name || "DEFAULT"] = v;
      }
    };
    flatten(values, "");
    for (const [name, value] of Object.entries(flat)) {
      const key = JSON.stringify(value);
      ((defs[section] ??= {})[name] ??= {})[key] ??= [];
      defs[section][name][key].push(screen.split("/")[1]);
    }
  }
}

for (const [section, names] of Object.entries(defs)) {
  const conflicts = Object.entries(names).filter(([, values]) => Object.keys(values).length > 1);
  console.log(`\n## ${section}: ${Object.keys(names).length} names, ${conflicts.length} with differing values`);
  for (const [name, values] of conflicts) {
    console.log(`  ${name}`);
    for (const [value, screens] of Object.entries(values)) console.log(`    ${value}  <- ${screens.join(", ")}`);
  }
}
console.log("\n## fonts per screen");
for (const [screen, list] of Object.entries(fonts)) console.log(`  ${screen}: ${list.join(", ")}`);

const jsonAt = process.argv.indexOf("--json");
if (jsonAt > 0) await writeFile(process.argv[jsonAt + 1], JSON.stringify(defs, null, 2));
