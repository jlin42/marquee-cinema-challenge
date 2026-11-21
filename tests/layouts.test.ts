import { describe, expect, it } from "vitest";
import { LAYOUTS, parseLayout } from "@/db/layouts";

const FRONT_ROWS = 4;
const AISLE_Y = FRONT_ROWS; // cross-aisle right after the front section
const ACCESSIBLE_Y = FRONT_ROWS + 1; // accessible row right after the aisle

describe.each(Object.entries(LAYOUTS))("%s auditorium", (_name, rows) => {
  const seats = parseLayout(rows);

  it("has rows of equal width", () => {
    expect(new Set(rows.map((r) => r.length)).size).toBe(1);
  });

  it("has a 4-row front section, then a cross-aisle", () => {
    for (let y = 0; y < FRONT_ROWS; y++) expect(seats.some((s) => s.y === y)).toBe(true);
    expect(rows[AISLE_Y]).toMatch(/^\.+$/);
    expect(seats.some((s) => s.y === AISLE_Y)).toBe(false);
  });

  it("puts every wheelchair space in the accessible row after the aisle", () => {
    const wheelchairs = seats.filter((s) => s.type === "wheelchair");
    expect(wheelchairs.length).toBeGreaterThan(0);
    for (const w of wheelchairs) expect(w.y).toBe(ACCESSIBLE_Y);
  });

  it("pairs each wheelchair space with a companion seat", () => {
    for (const w of seats.filter((s) => s.type === "wheelchair")) {
      const besides = seats.filter((s) => s.y === w.y && Math.abs(s.x - w.x) === 1);
      expect(besides.some((n) => n.type === "companion")).toBe(true);
    }
  });

  it("leaves gaps between wheelchair spaces", () => {
    const xs = seats.filter((s) => s.type === "wheelchair").map((s) => s.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThan(2);
  });

  it("gives every seat a unique position", () => {
    expect(new Set(seats.map((s) => `${s.x},${s.y}`)).size).toBe(seats.length);
  });
});

describe("parseLayout", () => {
  it("letters rows from the screen back, skipping I and the cross-aisle", () => {
    const seats = parseLayout(LAYOUTS.large);
    expect([...new Set(seats.map((s) => s.rowLabel))].join("")).toBe("ABCDEFGHJ");
    const rowE = seats.filter((s) => s.rowLabel === "E");
    expect(new Set(rowE.map((s) => s.y))).toEqual(new Set([ACCESSIBLE_Y]));
  });

  it("numbers seats left to right", () => {
    const rowC = parseLayout(LAYOUTS.large).filter((s) => s.rowLabel === "C");
    expect(rowC.map((s) => s.number)).toEqual(rowC.map((_, i) => i + 1));
    expect(rowC.map((s) => s.x)).toEqual([...rowC.map((s) => s.x)].sort((a, b) => a - b));
  });

  it("rejects malformed maps", () => {
    expect(() => parseLayout(["ss", "sss"])).toThrow(/wide/);
    expect(() => parseLayout(["sx"])).toThrow(/Unknown/);
  });
});
