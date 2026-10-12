import { describe, expect, it } from "vitest";
import { qrShape } from "@/components/ui/QrCode";
import { hexOf } from "@/lib/colour";

describe("the invitation's QR code", () => {
  const link = `https://t.me/Splitlly_bot?startapp=${"Ab3_-".repeat(8)}xyz`;

  it("is drawn from the link itself, the same every time, and differently for a different link", () => {
    const shape = qrShape(link);
    // A QR code is a square of 21, 25, 29… modules; a link this long needs one of the middle sizes.
    expect((shape.size - 17) % 4).toBe(0);
    expect(shape.size).toBeGreaterThanOrEqual(29);
    expect(shape.size).toBeLessThanOrEqual(45);
    expect(qrShape(link)).toEqual(shape);
    expect(qrShape(`${link}0`).path).not.toBe(shape.path);
  });

  it("has the three corner marks a scanner looks for, and nothing outside its square", () => {
    const { size, path } = qrShape(link);
    // Each corner mark starts with a run of seven dark modules: top left, top right, bottom left.
    expect(path).toContain("M0 0h7v1h-7z");
    expect(path).toContain(`M${size - 7} 0h7v1h-7z`);
    expect(path).toContain(`M0 ${size - 7}h7v1h-7z`);
    for (const [, column, row, run] of path.matchAll(/M(\d+) (\d+)h(\d+)v1/g)) {
      expect(Number(column) + Number(run)).toBeLessThanOrEqual(size);
      expect(Number(row)).toBeLessThan(size);
    }
  });
});

describe("colours for Telegram's own frame", () => {
  it("are given in the one form Telegram takes", () => {
    expect(hexOf("rgb(248, 247, 243)")).toBe("#f8f7f3");
    expect(hexOf("rgba(17, 26, 23, 0.95)")).toBe("#111a17");
    expect(hexOf("rgb(0,0,0)")).toBe("#000000");
    for (const bad of ["", "#f8f7f3", "transparent", "rgb(300, 0, 0)", "color(srgb 1 1 1)"]) expect(hexOf(bad)).toBeNull();
  });
});
