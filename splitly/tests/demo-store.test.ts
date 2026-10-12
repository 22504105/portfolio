import { beforeEach, describe, expect, it } from "vitest";
import { netsOf } from "@/lib/balances/net";
import { createDemoStore, DEMO_STORAGE_KEY, type Shelf } from "@/lib/store/demo";
import { seedGroups } from "@/lib/store/seed";
import { StoreError } from "@/lib/store/types";

const shelfOf = (data: Record<string, string> = {}): Shelf & { data: Record<string, string> } => ({
  data,
  getItem: (key) => data[key] ?? null,
  setItem: (key, value) => void (data[key] = value),
  removeItem: (key) => void delete data[key],
});

let ids = 0;
const nextId = () => `id-${++ids}`;
const code = async (work: Promise<unknown>) =>
  work.then(
    () => "ok",
    (error) => (error instanceof StoreError ? error.code : `threw ${error}`),
  );

let shelf: ReturnType<typeof shelfOf>;
let store: ReturnType<typeof createDemoStore>;

beforeEach(() => {
  shelf = shelfOf();
  store = createDemoStore(shelf, "en", nextId);
});

const dinner = (payer: string, participants: string[], totalMinor = 1000) => ({
  description: "Dinner",
  category: "food",
  date: "2026-10-12",
  currency: "TRY",
  totalMinor,
  payers: [{ memberId: payer, paidMinor: totalMinor }],
  split: { mode: "equal", parts: participants.map((memberId) => ({ memberId, value: 1 })) },
});

describe("the invented groups", () => {
  it("balance to the last unit, in both languages", () => {
    for (const locale of ["en", "ru"]) {
      for (const group of seedGroups(locale)) {
        for (const expense of group.expenses) {
          expect(expense.payers.reduce((sum, payer) => sum + payer.paidMinor, 0)).toBe(expense.totalMinor);
          expect(expense.splits.reduce((sum, split) => sum + split.owedMinor, 0)).toBe(expense.totalMinor);
          const members = new Set(group.members.map((member) => member.id));
          expect([...expense.payers, ...expense.splits].every((part) => members.has(part.memberId))).toBe(true);
        }
        for (const nets of Object.values(netsOf(group.expenses))) expect(Object.values(nets).reduce((a, b) => a + b, 0)).toBe(0);
        expect(group.members.filter((member) => member.self)).toHaveLength(1);
      }
    }
  });

  it("show every kind of thing the app holds", () => {
    const expenses = seedGroups("en").flatMap((group) => group.expenses);
    expect(new Set(expenses.map((expense) => expense.split.mode))).toEqual(new Set(["equal", "exact", "percent", "shares"]));
    expect(expenses.some((expense) => expense.status === "cancelled")).toBe(true);
    expect(expenses.some((expense) => expense.totalMinor < 0)).toBe(true);
    expect(expenses.some((expense) => expense.payers.length > 1)).toBe(true);
    expect(new Set(expenses.map((expense) => expense.currency)).size).toBeGreaterThan(1);
  });

  it("are what a first visit sees, with the visitor's standing worked out", async () => {
    const groups = await store.listGroups();
    expect(groups.map((group) => [group.name, group.baseCurrency, group.expenseCount])).toEqual([
      ["Istanbul weekend", "TRY", 6],
      ["Flat in Moda", "EUR", 4],
    ]);
    // Dinner 248000 paid, taxi 50000 paid; owes 62000 + 45000 + 9013 + 23750 + 12000.
    expect(groups[0].myNet).toEqual({ TRY: 298_000 - (62_000 + 45_000 + 9_013 + 23_750 + 12_000) });
    expect(Object.keys(groups[1].myNet).sort()).toEqual(["EUR", "TRY"]);
    // Nothing is written until something changes.
    expect(shelf.data).toEqual({});
  });

  it("speak Russian to a Russian visitor", async () => {
    expect((await createDemoStore(shelfOf(), "ru").listGroups())[0].name).toBe("Выходные в Стамбуле");
  });
});

describe("the demo keeps what you do, in this browser only", () => {
  it("a new group and its expense survive a reload", async () => {
    const id = await store.createGroup({ name: "  Road trip ", baseCurrency: "EUR" });
    const guest = await store.addGuest(id, "Lena");
    const me = (await store.getGroup(id))!.members[0].id;
    await store.createExpense(id, "key-00000001", dinner(me, [me, guest]));

    const reloaded = createDemoStore(shelfOf({ ...shelf.data }), "en");
    const group = (await reloaded.getGroup(id))!;
    expect([group.name, group.members.map((member) => member.name), group.myNet]).toEqual(["Road trip", ["Alex", "Lena"], { TRY: 500 }]);
    expect((await reloaded.listGroups())[0].id).toBe(id);
  });

  it("starts again from the invented groups after a reset, or when what was stored is unreadable", async () => {
    await store.deleteGroup("demo-flat");
    expect(await store.listGroups()).toHaveLength(1);
    store.reset();
    expect(await store.listGroups()).toHaveLength(2);
    expect(shelf.data[DEMO_STORAGE_KEY]).toBeUndefined();

    for (const broken of ["{not json", "null", '{"version":7}', "[]"])
      expect(await createDemoStore(shelfOf({ [DEMO_STORAGE_KEY]: broken }), "en").listGroups()).toHaveLength(2);
  });

  it("still works when the browser will not store anything", async () => {
    const full: Shelf = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    const fragile = createDemoStore(full, "en", nextId);
    const id = await fragile.createGroup({ name: "Trip", baseCurrency: "TRY" });
    expect((await fragile.getGroup(id))?.name).toBe("Trip");
    fragile.reset();
    expect(await fragile.getGroup(id)).toBeNull();
  });
});

describe("the demo follows the same rules as the server", () => {
  it("refuses an expense that does not add up, with the same reasons", async () => {
    const bad = { ...dinner("t-you", ["t-you", "t-deniz"]), payers: [{ memberId: "t-you", paidMinor: 900 }] };
    const error = await store.createExpense("demo-istanbul", "key-00000002", bad).catch((caught) => caught);
    expect(error).toBeInstanceOf(StoreError);
    expect([error.code, error.details.problems, error.details.differences]).toEqual(["invalid", ["payers_sum"], { payers_sum: 100 }]);
    expect((await store.getGroup("demo-istanbul"))!.expenses).toHaveLength(7);
  });

  it("works shares out itself and ignores any that are sent", async () => {
    const id = await store.createExpense("demo-istanbul", "key-00000003", {
      ...dinner("t-you", ["t-you", "t-deniz", "t-mira"]),
      splits: [{ memberId: "t-you", owedMinor: 0 }],
    });
    const stored = (await store.getGroup("demo-istanbul"))!.expenses.find((expense) => expense.id === id)!;
    expect(stored.splits.map((split) => split.owedMinor)).toEqual([334, 333, 333]);
  });

  it("a form submitted twice makes one expense", async () => {
    const first = await store.createExpense("demo-istanbul", "key-00000004", dinner("t-you", ["t-you"]));
    const second = await store.createExpense("demo-istanbul", "key-00000004", dinner("t-you", ["t-you"]));
    expect(second).toBe(first);
    expect((await store.getGroup("demo-istanbul"))!.expenses).toHaveLength(8);
  });

  it("changes an expense by replacing it, and cancels without erasing", async () => {
    const before = (await store.getGroup("demo-istanbul"))!.myNet.TRY;
    const id = await store.replaceExpense("demo-istanbul", "t-e3", "key-00000005", dinner("t-you", ["t-you", "t-deniz"], 200_000));
    let group = (await store.getGroup("demo-istanbul"))!;
    expect(group.expenses.find((expense) => expense.id === "t-e3")!.status).toBe("replaced");
    // Was: paid 248000, owed 62000. Now: paid 200000, owed 100000.
    expect(group.myNet.TRY).toBe(before - 186_000 + 100_000);
    expect(await code(store.replaceExpense("demo-istanbul", "t-e3", "key-00000006", dinner("t-you", ["t-you"])))).toBe("conflict");

    await store.cancelExpense("demo-istanbul", id);
    await store.cancelExpense("demo-istanbul", id);
    group = (await store.getGroup("demo-istanbul"))!;
    expect(group.expenses.find((expense) => expense.id === id)!.status).toBe("cancelled");
    expect(group.myNet.TRY).toBe(before - 186_000);
    expect(group.expenses).toHaveLength(8);
  });

  it("someone who was removed stays in the history and takes no part in new expenses", async () => {
    await store.removeMember("demo-istanbul", "t-mira");
    const group = (await store.getGroup("demo-istanbul"))!;
    expect(group.members.find((member) => member.id === "t-mira")!.removedAt).not.toBeNull();
    expect(group.expenses.some((expense) => expense.payers.some((payer) => payer.memberId === "t-mira"))).toBe(true);
    const error = await store
      .createExpense("demo-istanbul", "key-00000007", dinner("t-you", ["t-you", "t-mira"]))
      .catch((caught) => caught);
    expect(error.details.problems).toEqual(["participant_unknown"]);
  });

  it("keeps the roles: the owner cannot be removed or leave, guests cannot manage, names are checked", async () => {
    expect(await code(store.removeMember("demo-istanbul", "t-you"))).toBe("forbidden");
    expect(await code(store.setRole("demo-istanbul", "t-kerem", "admin"))).toBe("not_found");
    expect(await code(store.setRole("demo-istanbul", "t-mira", "admin"))).toBe("ok");
    expect(await code(store.setRole("demo-istanbul", "t-mira", "owner" as "admin"))).toBe("invalid");
    expect(await code(store.addGuest("demo-istanbul", "   "))).toBe("invalid");
    expect(await code(store.createGroup({ name: "x".repeat(81), baseCurrency: "TRY" }))).toBe("invalid");
    expect(await code(store.createGroup({ name: "Trip", baseCurrency: "lira" }))).toBe("invalid");
    expect(await code(store.updateGroup("nowhere", { name: "x" }))).toBe("not_found");
    expect(await store.getGroup("nowhere")).toBeNull();
  });

  it("an archived group takes no new expenses until it is brought back", async () => {
    await store.updateGroup("demo-flat", { archived: true });
    expect(await code(store.createExpense("demo-flat", "key-00000008", dinner("f-you", ["f-you"])))).toBe("conflict");
    expect((await store.listGroups()).map((group) => group.id)).toEqual(["demo-istanbul", "demo-flat"]);
    await store.updateGroup("demo-flat", { archived: false });
    expect(await code(store.createExpense("demo-flat", "key-00000008", dinner("f-you", ["f-you"])))).toBe("ok");
  });

  it("says plainly that invitations are not part of the demo", async () => {
    expect(await code(store.createInvite("demo-istanbul"))).toBe("forbidden");
    expect(await code(store.acceptInvite("x"))).toBe("not_found");
  });
});

describe("settling up in the demo follows the same rules", () => {
  it("starts with a payment someone says they made, which changes nothing until it is confirmed", async () => {
    const before = (await store.getGroup("demo-istanbul"))!;
    expect(
      before.settlements.map((settlement) => [settlement.fromMemberId, settlement.toMemberId, settlement.amountMinor, settlement.status]),
    ).toEqual([["t-deniz", "t-you", 30_000, "proposed"]]);
    expect(before.myNet).toEqual({ TRY: 146_237 });

    await store.confirmSettlement("demo-istanbul", "t-s1");
    await store.confirmSettlement("demo-istanbul", "t-s1");
    expect((await store.getGroup("demo-istanbul"))!.myNet).toEqual({ TRY: 116_237 });
    expect((await store.listGroups())[0].myNet).toEqual({ TRY: 116_237 });

    // Taken back: it stays on record as cancelled and stops counting.
    await store.cancelSettlement("demo-istanbul", "t-s1");
    const after = (await store.getGroup("demo-istanbul"))!;
    expect([after.settlements[0].status, after.myNet]).toEqual(["cancelled", { TRY: 146_237 }]);
    expect(await code(store.confirmSettlement("demo-istanbul", "t-s1"))).toBe("conflict");
  });

  it("a payment the owner records counts at once, once per submission, and bad ones are refused", async () => {
    const pay = (key: string, input: unknown) => store.createSettlement("demo-istanbul", key, input);
    const id = await pay("key-settle-1", { fromMemberId: "t-you", toMemberId: "t-mira", currency: "TRY", amountMinor: 5000 });
    expect(await pay("key-settle-1", { fromMemberId: "t-you", toMemberId: "t-mira", currency: "TRY", amountMinor: 5000 })).toBe(id);
    const group = (await store.getGroup("demo-istanbul"))!;
    expect(group.settlements.filter((settlement) => settlement.status === "confirmed")).toHaveLength(1);
    expect(group.myNet).toEqual({ TRY: 151_237 });
    const error = await pay("key-settle-2", { fromMemberId: "t-you", toMemberId: "t-you", currency: "TRY", amountMinor: 0 }).catch(
      (caught) => caught,
    );
    expect([error.code, error.details.problems]).toEqual(["invalid", ["same", "amount"]]);
    expect(await code(store.cancelSettlement("demo-istanbul", "nope"))).toBe("not_found");
  });

  it("rates are recorded and kept; a new one is added beside the old", async () => {
    expect((await store.getGroup("demo-flat"))!.rates.map((rate) => [rate.from, rate.to, rate.rate])).toEqual([["EUR", "TRY", "36.5"]]);
    await store.addRate("demo-flat", { from: "EUR", to: "TRY", rate: "37,1", effectiveDate: "2026-10-10" });
    expect((await store.getGroup("demo-flat"))!.rates.map((rate) => rate.rate)).toEqual(["37.1", "36.5"]);
    expect(await code(store.addRate("demo-flat", { from: "EUR", to: "EUR", rate: "1", effectiveDate: "2026-10-10" }))).toBe("invalid");
  });
});
