import { describe, expect, it } from "vitest";
import { priceTickets, type TicketType } from "@/server/pricing";

const PRICE_LIST: TicketType[] = [
  { code: "general", label: "General", description: null, priceCents: 1475, feeCents: 199, sortOrder: 1 },
  { code: "child", label: "Child", description: "3–11 years", priceCents: 1175, feeCents: 199, sortOrder: 2 },
  { code: "senior", label: "Senior", description: "60+ years", priceCents: 1125, feeCents: 199, sortOrder: 3 },
];

describe("priceTickets", () => {
  it("prices each seat from the price list and totals price plus fee", () => {
    const result = priceTickets(["a", "b", "c"], { a: "general", b: "child", c: "senior" }, PRICE_LIST);
    expect(result?.lines.map((l) => [l.seatId, l.ticketType, l.priceCents, l.feeCents])).toEqual([
      ["a", "general", 1475, 199],
      ["b", "child", 1175, 199],
      ["c", "senior", 1125, 199],
    ]);
    expect(result?.totalCents).toBe(1674 + 1374 + 1324);
  });

  it("treats seats without a choice as General", () => {
    expect(priceTickets(["a", "b"], {}, PRICE_LIST)?.lines.every((l) => l.ticketType === "general")).toBe(true);
  });

  it("rejects tickets for seats outside the hold", () => {
    expect(priceTickets(["a"], { z: "child" }, PRICE_LIST)).toBeNull();
  });

  it("rejects a type missing from the price list", () => {
    expect(priceTickets(["a"], { a: "child" }, PRICE_LIST.filter((t) => t.code !== "child"))).toBeNull();
  });
});
