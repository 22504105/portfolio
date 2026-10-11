// Writes the two sample files offered on the Imports page. Run once; the
// files are committed.  Usage: node scripts/make-samples.mjs
//
// The data is invented, like the demo's: people at @example.com, a made-up shop.

import { mkdirSync, writeFileSync } from "node:fs";
import writeXlsxFile from "write-excel-file/node";

const HEADER = [
  "Order ID",
  "Order Date",
  "Customer ID",
  "Customer Name",
  "Customer Email",
  "Product",
  "Category",
  "Channel",
  "Quantity",
  "Unit Price",
  "Discount",
  "Total",
  "Status",
];

const PRODUCTS = [
  ["Sencha Everyday 100g", "Tea", 14],
  ["House Espresso 340g", "Coffee", 17],
  ["Stoneware Mug 300ml", "Cups & mugs", 18],
  ["Pour-over Dripper", "Brewing gear", 28],
  ["Paper Filters x100", "Accessories", 9],
  ["Matcha Ceremonial 30g", "Tea", 34],
  ["Tasting Box - 6 Teas", "Gift sets", 38],
];
const CHANNELS = ["Organic search", "Email", "Paid social", "Direct"];
const PEOPLE = [
  ["C-1001", "Ada Marsh"],
  ["C-1002", "Leo Tanaka"],
  ["C-1003", "Ines Novak"],
  ["C-1004", "Omar Reyes"],
  ["C-1005", "Maya Frost"],
  ["C-1006", "Hugo Park"],
  ["C-1007", "Zoe Castro"],
  ["C-1008", "Sam Okoro"],
];

// A fixed sequence, so the file is the same every time it is made.
let state = 7;
const next = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (items) => items[Math.floor(next() * items.length)];

const rows = [];
for (let n = 0; n < 60; n++) {
  const day = new Date(Date.UTC(2026, 6, 1 + Math.floor((n * 92) / 60), 9 + Math.floor(next() * 11), Math.floor(next() * 60)));
  const [product, category, price] = pick(PRODUCTS);
  const quantity = next() < 0.7 ? 1 : next() < 0.8 ? 2 : 3;
  const discount = next() < 0.15 ? Math.round(price * quantity * 0.1 * 100) / 100 : 0;
  // About one order in seven is a guest checkout: no customer at all.
  const person = next() < 0.14 ? null : pick(PEOPLE);
  const roll = next();
  const status = n >= 57 ? "pending" : roll < 0.05 ? "cancelled" : roll < 0.1 ? "refunded" : "completed";
  rows.push({
    id: `S-${2001 + n}`,
    date: day,
    customerId: person?.[0] ?? "",
    name: person?.[1] ?? "",
    email: person ? `${person[1].toLowerCase().replace(" ", ".")}@example.com` : "",
    product,
    category,
    channel: pick(CHANNELS),
    quantity,
    price,
    discount,
    total: Math.round((price * quantity - discount) * 100) / 100,
    status,
  });
}

const stamp = (date) => date.toISOString().slice(0, 16).replace("T", " ");
const csvCell = (value) => (/[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value));
const csv = [
  HEADER,
  ...rows.map((r) => [
    r.id,
    stamp(r.date),
    r.customerId,
    r.name,
    r.email,
    r.product,
    r.category,
    r.channel,
    r.quantity,
    r.price.toFixed(2),
    r.discount.toFixed(2),
    r.total.toFixed(2),
    r.status,
  ]),
]
  .map((row) => row.map(csvCell).join(","))
  .join("\r\n");

mkdirSync("public/samples", { recursive: true });
writeFileSync("public/samples/flowly-sample.csv", csv + "\r\n");

// The template: the same headings, eight example rows to type over, real date and number cells.
const head = HEADER.map((value) => ({ value, fontWeight: "bold" }));
const body = rows
  .slice(0, 8)
  .map((r) => [
    { value: r.id },
    { value: r.date, type: Date, format: "yyyy-mm-dd hh:mm" },
    { value: r.customerId },
    { value: r.name },
    { value: r.email },
    { value: r.product },
    { value: r.category },
    { value: r.channel },
    { value: r.quantity, type: Number },
    { value: r.price, type: Number, format: "0.00" },
    { value: r.discount, type: Number, format: "0.00" },
    { value: r.total, type: Number, format: "0.00" },
    { value: r.status },
  ]);
await writeXlsxFile([head, ...body], { sheet: "Orders", columns: HEADER.map((name) => ({ width: Math.max(12, name.length + 4) })) }).toFile(
  "public/samples/flowly-template.xlsx",
);

console.log(`sample CSV: ${rows.length} rows; template: ${body.length} rows`);
