"use client";

import { useId, useTransition } from "react";
import { useDisclosure } from "@/hooks/use-disclosure";
import { selectLocation } from "./actions";
import type { LocationOptionVM } from "./location-view-model";

/** View-model hook for the theater picker: open/close state and selection. */
export function useLocationPicker(options: LocationOptionVM[]) {
  const disclosure = useDisclosure<HTMLDivElement>();
  const [isSaving, startTransition] = useTransition();
  const listId = useId();

  const choose = (id: string) => {
    disclosure.close();
    if (options.find((o) => o.id === id)?.isSelected) return;
    startTransition(() => selectLocation(id));
  };

  return {
    rootRef: disclosure.ref,
    isOpen: disclosure.isOpen,
    toggle: disclosure.toggle,
    choose,
    isSaving,
    listId,
  };
}
