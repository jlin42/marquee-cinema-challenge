import { describe, expect, it } from "vitest";
import { paginateByMonth } from "@/components/date-strip/paginate-dates";

const days = (month: string, n: number) => Array.from({ length: n }, (_, i) => ({ monthLabel: month, day: i + 1 }));
const sizes = (pages: { items: unknown[] }[]) => pages.map((p) => p.items.length);

describe("paginateByMonth", () => {
  it("never mixes months on a page", () => {
    const pages = paginateByMonth([...days("NOV", 10), ...days("DEC", 31)], 11);
    for (const p of pages) expect(new Set(p.items.map((i) => i.monthLabel)).size).toBe(1);
    expect(pages[0]!.month).toBe("NOV");
  });

  it("splits a month evenly instead of leaving a stub page", () => {
    expect(sizes(paginateByMonth(days("DEC", 31), 11))).toEqual([11, 10, 10]);
    expect(sizes(paginateByMonth(days("DEC", 31), 14))).toEqual([11, 10, 10]);
    expect(sizes(paginateByMonth(days("DEC", 31), 30))).toEqual([16, 15]);
  });

  it("keeps every date exactly once, in order", () => {
    const all = [...days("NOV", 10), ...days("DEC", 31)];
    const flat = paginateByMonth(all, 7).flatMap((p) => p.items);
    expect(flat).toEqual(all);
  });

  it("never exceeds capacity", () => {
    for (const cap of [1, 3, 7, 9, 12]) {
      for (const p of paginateByMonth(days("DEC", 31), cap)) expect(p.items.length).toBeLessThanOrEqual(cap);
    }
  });
});
