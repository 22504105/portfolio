import type { Customer, Dataset, Order, OrderLine, OrderStatus } from "@/lib/domain/types";
import { addDays, daysIn } from "@/lib/time";

// The demo workspace: a fictional online shop for tea and coffee gear. Every
// figure on every demo page is calculated from the orders made here; nothing
// is typed in by hand. The generator is seeded and uses no clock and no
// Math.random, so it produces the same orders on every machine, every time.
// People, emails and the shop are invented; the email domain is reserved for
// examples and can never belong to anyone.

export const DEMO_SEED = 20261011;
/** The last day the demo has orders for. Fixed, so the demo does not drift with the calendar. */
export const DEMO_LAST_DAY = "2026-09-30";
export const DEMO_FIRST_DAY = "2025-08-01";
const TIMEZONE = "America/New_York";

/** A small seeded generator (mulberry32): the same seed gives the same sequence everywhere. */
export function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** A whole number from min to max, both included. */
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    /** An index chosen in proportion to the weights. */
    weighted: (weights: readonly number[]) => {
      let roll = next() * weights.reduce((sum, weight) => sum + weight, 0);
      for (let i = 0; i < weights.length; i++) if ((roll -= weights[i]) < 0) return i;
      return weights.length - 1;
    },
  };
}

const CHANNELS = ["Organic search", "Email", "Paid social", "Direct", "Marketplace"] as const;
const CHANNEL_WEIGHTS = [30, 22, 18, 17, 13];

// [name, category, price in cents, relative popularity]
const PRODUCTS: readonly (readonly [string, string, number, number])[] = [
  ["Sencha Everyday 100g", "Tea", 1400, 9],
  ["Jasmine Pearls 80g", "Tea", 2200, 6],
  ["Assam Breakfast 250g", "Tea", 1600, 8],
  ["Oolong Milk 100g", "Tea", 1900, 5],
  ["Matcha Ceremonial 30g", "Tea", 3400, 6],
  ["Chamomile Whole Flower 60g", "Tea", 1200, 4],
  ["Earl Grey Reserve 150g", "Tea", 1800, 7],
  ["Chai Spice Blend 200g", "Tea", 1500, 5],
  ["House Espresso 340g", "Coffee", 1700, 10],
  ["Ethiopia Guji 340g", "Coffee", 2100, 7],
  ["Colombia Huila 340g", "Coffee", 1900, 7],
  ["Decaf Swiss Water 340g", "Coffee", 1800, 3],
  ["Cold Brew Blend 500g", "Coffee", 2300, 4],
  ["Kenya AA 250g", "Coffee", 2400, 4],
  ["Pour-over Dripper", "Brewing gear", 2800, 5],
  ["Gooseneck Kettle 0.9L", "Brewing gear", 6900, 3],
  ["French Press 1L", "Brewing gear", 3900, 4],
  ["Hand Grinder", "Brewing gear", 8900, 2],
  ["Glass Teapot 600ml", "Brewing gear", 3200, 4],
  ["Cold Brew Bottle", "Brewing gear", 2600, 3],
  ["Digital Scale", "Brewing gear", 4500, 2],
  ["Paper Filters ×100", "Accessories", 900, 9],
  ["Bamboo Whisk", "Accessories", 1800, 4],
  ["Tea Infuser Basket", "Accessories", 1100, 6],
  ["Airtight Canister", "Accessories", 2000, 5],
  ["Measuring Spoon", "Accessories", 700, 4],
  ["Stoneware Mug 300ml", "Cups & mugs", 1800, 7],
  ["Double-wall Glass ×2", "Cups & mugs", 2400, 5],
  ["Travel Tumbler 350ml", "Cups & mugs", 2900, 5],
  ["Espresso Cups ×4", "Cups & mugs", 3200, 3],
  ["Starter Tea Set", "Gift sets", 5400, 3],
  ["Barista Home Kit", "Gift sets", 11900, 2],
  ["Tasting Box — 6 Teas", "Gift sets", 3800, 4],
  ["Coffee Sampler — 4 Origins", "Gift sets", 4200, 4],
];
const PRODUCT_WEIGHTS = PRODUCTS.map((product) => product[3]);

const FIRST_NAMES = [
  "Ada",
  "Amir",
  "Anya",
  "Ben",
  "Carla",
  "Chen",
  "Dana",
  "Diego",
  "Elif",
  "Emma",
  "Farid",
  "Grace",
  "Hana",
  "Hugo",
  "Ines",
  "Ivan",
  "Jade",
  "Jonas",
  "Kira",
  "Leo",
  "Lina",
  "Luca",
  "Maya",
  "Milan",
  "Nadia",
  "Noah",
  "Olga",
  "Omar",
  "Priya",
  "Quinn",
  "Rosa",
  "Sam",
  "Sara",
  "Tariq",
  "Uma",
  "Vera",
  "Wes",
  "Yara",
  "Zane",
  "Zoe",
];
const LAST_NAMES = [
  "Abbot",
  "Baker",
  "Castro",
  "Dubois",
  "Eklund",
  "Farrow",
  "Garza",
  "Hale",
  "Ito",
  "Jensen",
  "Kovac",
  "Lindqvist",
  "Marsh",
  "Novak",
  "Okoro",
  "Park",
  "Quill",
  "Reyes",
  "Sato",
  "Tanaka",
  "Ueda",
  "Vance",
  "Wolfe",
  "Xu",
  "Young",
  "Zeller",
  "Archer",
  "Brandt",
  "Costa",
  "Dorsey",
  "Ellis",
  "Frost",
  "Greer",
  "Holt",
  "Ivers",
];

const DAY_MS = 86_400_000;
// Weekends are busier for a shop like this.
const WEEKDAY_FACTOR = [1.2, 0.92, 0.9, 0.94, 1.0, 1.08, 1.25];
// Gift season in November and December, a quiet January, a small lift in May.
const MONTH_FACTOR = [0.82, 0.9, 0.96, 1.0, 1.08, 0.98, 0.94, 0.96, 1.02, 1.08, 1.34, 1.6];
const CUSTOMER_POOL = 1180;

function sum(lines: OrderLine[], field: "grossMinor" | "discountMinor" | "netMinor") {
  return lines.reduce((total, line) => total + line[field], 0);
}

function generate(): Dataset {
  const random = createRandom(DEMO_SEED);
  const totalDays = daysIn({ from: DEMO_FIRST_DAY, to: DEMO_LAST_DAY });

  const customers: Customer[] = [];
  // How likely each known customer is to come back, and where they first came from.
  const loyalty: number[] = [];
  const homeChannel: number[] = [];
  const orders: Order[] = [];
  let loyaltyTotal = 0;

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const day = addDays(DEMO_FIRST_DAY, dayIndex);
    const date = new Date(`${day}T00:00:00Z`);
    // The shop grows over the period, from about nine orders a day to about fifteen.
    const base = 9 + (6 * dayIndex) / totalDays;
    const expected = base * WEEKDAY_FACTOR[date.getUTCDay()] * MONTH_FACTOR[date.getUTCMonth()];
    const count = Math.max(0, Math.round(expected * (0.75 + random.next() * 0.5)));
    const daysFromEnd = totalDays - 1 - dayIndex;

    for (let n = 0; n < count; n++) {
      // Between about 08:00 and midnight New York time, written down in UTC (New York is 4 or 5 hours behind).
      const placedAt = date.getTime() + 13 * 3_600_000 + Math.floor(random.next() * 14.9 * 3_600_000);

      // Who bought. About one order in eight is a guest checkout with no identity.
      let customerIndex: number | null = null;
      if (random.next() >= 0.125) {
        const share = customers.length / CUSTOMER_POOL;
        // New customers are common early on and rarer as the pool fills.
        if (customers.length < CUSTOMER_POOL && (customers.length < 40 || random.next() > 0.25 + share * 0.5)) {
          const first = random.pick(FIRST_NAMES);
          const last = random.pick(LAST_NAMES);
          const number = customers.length + 1;
          customerIndex = customers.length;
          customers.push({
            id: `demo-customer-${number}`,
            externalId: `C-${String(1000 + number)}`,
            name: `${first} ${last}`,
            email: `${first}.${last}${number}@example.com`.toLowerCase(),
          });
          const weight = 0.3 + random.next() ** 3 * 6;
          loyalty.push(weight);
          loyaltyTotal += weight;
          homeChannel.push(random.weighted(CHANNEL_WEIGHTS));
        } else {
          let roll = random.next() * loyaltyTotal;
          customerIndex = 0;
          while (customerIndex < loyalty.length - 1 && (roll -= loyalty[customerIndex]) >= 0) customerIndex++;
        }
      }

      const channelIndex = customerIndex !== null && random.next() < 0.6 ? homeChannel[customerIndex] : random.weighted(CHANNEL_WEIGHTS);

      // One to four different products; a tenth or 15% off on roughly one order in six.
      const lineCount = random.weighted([52, 30, 13, 5]) + 1;
      const discountPercent = random.next() < 0.17 ? random.pick([10, 15]) : 0;
      const chosen = new Set<number>();
      const lines: OrderLine[] = [];
      while (lines.length < lineCount) {
        const productIndex = random.weighted(PRODUCT_WEIGHTS);
        if (chosen.has(productIndex)) continue;
        chosen.add(productIndex);
        const [productName, category, unitPriceMinor] = PRODUCTS[productIndex];
        const quantity = unitPriceMinor >= 4000 ? 1 : random.weighted([70, 22, 8]) + 1;
        const grossMinor = quantity * unitPriceMinor;
        const discountMinor = Math.round((grossMinor * discountPercent) / 100);
        lines.push({ productName, category, quantity, unitPriceMinor, grossMinor, discountMinor, netMinor: grossMinor - discountMinor });
      }

      const netMinor = sum(lines, "netMinor");
      // The last few days still have orders in progress; older ones are settled.
      const roll = random.next();
      let status: OrderStatus = "completed";
      if (daysFromEnd <= 2 && roll < 0.3) status = "pending";
      else if (roll < 0.035) status = "cancelled";
      else if (roll < 0.075) status = "refunded";
      // Now and then one line of a completed order is sent back.
      const partial = status === "completed" && lines.length > 1 && random.next() < 0.025;

      orders.push({
        id: `demo-order-${orders.length + 1}`,
        externalId: `KK-${10001 + orders.length}`,
        placedAt,
        customerId: customerIndex === null ? null : customers[customerIndex].id,
        channel: CHANNELS[channelIndex],
        status,
        lines,
        grossMinor: sum(lines, "grossMinor"),
        discountMinor: sum(lines, "discountMinor"),
        netMinor,
        refundMinor: status === "refunded" ? netMinor : partial ? lines[lines.length - 1].netMinor : 0,
      });
    }
  }

  return {
    workspace: { id: "demo", name: "Kettle & Kin", currency: "USD", timezone: TIMEZONE },
    orders,
    customers,
    provenance: { kind: "demo" },
  };
}

let cached: Dataset | undefined;

/** The demo workspace. Built once per process; treat it as read-only. */
export function demoDataset(): Dataset {
  return (cached ??= generate());
}

/** The range the demo opens on: the last thirty days it has data for. */
export const DEMO_DEFAULT_RANGE = { from: addDays(DEMO_LAST_DAY, -29), to: DEMO_LAST_DAY } as const;

export { DAY_MS };
