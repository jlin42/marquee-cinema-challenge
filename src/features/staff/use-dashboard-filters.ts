"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

export type DashboardFilterKey = "location" | "screen" | "date" | "showing";

/** View-model hook: filters live in the URL, so changing one navigates and the server re-renders. */
export function useDashboardFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const go = (next: Partial<Record<DashboardFilterKey, string>>) => {
    const params = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
    startTransition(() => router.push(`${pathname}?${params}`));
  };

  return { go, isPending };
}
