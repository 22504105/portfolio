// Draws the application icons from one shape, so they cannot drift apart.
// Usage: node scripts/make-icons.mjs   (run once; the PNGs are committed)

import { mkdirSync } from "node:fs";
import sharp from "sharp";

// The mark of app/icon.svg on a 32-unit grid: a "C" in bone with a bar of signal.
// `inset` shrinks the mark towards the centre for the maskable icon, whose
// outer fifth a phone may crop to a circle or a rounded square.
const icon = (size, inset = 0) => {
  const scale = (32 - inset * 2) / 32;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
       <rect width="32" height="32" fill="#0c0c0b"/>
       <g transform="translate(${inset} ${inset}) scale(${scale})">
         <path d="M9 8h14v4H13v8h10v4H9z" fill="#f2eee5"/>
         <rect x="17" y="14" width="6" height="4" fill="#e5532b"/>
       </g>
     </svg>`,
  );
};

mkdirSync("public/icons", { recursive: true });
const write = (file, size, inset) => sharp(icon(size, inset), { density: 384 }).resize(size, size).png().toFile(file);

await write("public/icons/icon-192.png", 192);
await write("public/icons/icon-512.png", 512);
await write("public/icons/maskable-512.png", 512, 5);
await write("app/apple-icon.png", 180);
console.log("icons written");
