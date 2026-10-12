// Draws the invented receipts the scanner is tested with, as photos: a
// Turkish supermarket slip (the concept's own), an English restaurant bill, a
// Russian shop receipt, the Turkish one out of focus, and one that is not a
// receipt at all. Nothing here is a real receipt of anyone's.
//
//   node scripts/receipt-fixtures.mjs      writes e2e/fixtures/*.png
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const RECEIPTS = {
  "receipt-tr": `MIGROS
ISTANBUL
12.07.2024 15:32

SÜT 1L                 80,00
TAVUK GÖĞSÜ           360,00
EKMEK                  40,00
PEYNIR                240,00
DETERJAN              480,00

TOPKDV                 96,12
TOPLAM              1.200,00
KREDI KARTI         1.200,00

TESEKKUR EDERIZ`,
  "receipt-en": `THE HARBOUR GRILL
Table 12   03/10/2026

Lentil soup             9.00
Grilled salmon         24.50
Cola                   12.00
House wine             34.50
Discount               -4.55
Service charge          5.12

TOTAL                  80.57
Cash                  100.00
Change                 19.43`,
  "receipt-ru": `ООО ПРОДУКТЫ
Чек 118   05.10.2026 18:04

Молоко 1л               89,90
Хлеб бородинский        54,00
Помидоры               116,40
Сыр российский         312,50
Скидка по карте        -30,00

ИТОГ                   542,80
Безналичными           542,80`,
  "not-a-receipt": `Dear Anna,

thank you for the lovely weekend.
The garden looked wonderful and
the children are still talking
about the swing.

With love,
Marta`,
};

const page = (text, blur) => `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#8b8b85">
<pre id="receipt" style="margin:0;display:inline-block;padding:48px 44px;background:#fbfaf6;color:#1b1b1b;
font:600 30px/1.55 'Courier New',monospace;filter:${blur ? "blur(7px)" : "none"}">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`;

mkdirSync("e2e/fixtures", { recursive: true });
const browser = await chromium.launch({ channel: process.env.CI ? undefined : "chrome" });
const tab = await browser.newPage({ deviceScaleFactor: 1.5 });
for (const [name, text, blur] of [
  ...Object.entries(RECEIPTS).map(([name, text]) => [name, text, false]),
  ["receipt-tr-blurred", RECEIPTS["receipt-tr"], true],
]) {
  await tab.setContent(page(text, blur));
  await tab.locator("#receipt").screenshot({ path: `e2e/fixtures/${name}.png` });
  console.log(`e2e/fixtures/${name}.png`);
}
await browser.close();
