/**
 * Pure pagination for the date strip (no React, easy to unit test).
 *
 * Rules:
 *  - A page never mixes months.
 *  - Each month is split into the fewest pages that fit `capacity` dates,
 *    and its dates are spread evenly across them (31 days, capacity 11 → 11, 10, 10).
 */
export type DatePage<T> = { month: string; items: T[] };

export function paginateByMonth<T extends { monthLabel: string }>(items: T[], capacity: number): DatePage<T>[] {
  const size = Math.max(1, Math.floor(capacity));
  const pages: DatePage<T>[] = [];

  for (const group of groupConsecutive(items, (i) => i.monthLabel)) {
    const pageCount = Math.ceil(group.length / size);
    const base = Math.floor(group.length / pageCount);
    const extra = group.length % pageCount; // the first `extra` pages get one more date
    let start = 0;
    for (let p = 0; p < pageCount; p++) {
      const count = base + (p < extra ? 1 : 0);
      pages.push({ month: group[0]!.monthLabel, items: group.slice(start, start + count) });
      start += count;
    }
  }
  return pages;
}

function groupConsecutive<T>(items: T[], key: (item: T) => string): T[][] {
  const groups: T[][] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && key(last[0]!) === key(item)) last.push(item);
    else groups.push([item]);
  }
  return groups;
}
