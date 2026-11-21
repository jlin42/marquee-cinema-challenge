"use client";

import { Icon } from "@/components/ui/icon";
import { focusRing } from "@/components/ui/icon-button";
import type { LocationPickerVM } from "./location-view-model";
import { useLocationPicker } from "./use-location-picker";

/** View: pin + current theater; opens a list of theaters. */
export function LocationPicker({ vm }: { vm: LocationPickerVM }) {
  const picker = useLocationPicker(vm.options);

  return (
    <div ref={picker.rootRef} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={picker.isOpen}
        aria-controls={picker.listId}
        onClick={picker.toggle}
        className={`flex max-w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-white transition hover:bg-white/10 ${focusRing}`}
      >
        <Icon name="pin" className={`h-4 w-4 shrink-0 text-marquee-400 ${picker.isSaving ? "animate-pulse" : ""}`} />
        <span className="truncate">{vm.buttonLabel}</span>
        <Icon name="chevron-down" className={`h-4 w-4 shrink-0 text-neutral-400 transition ${picker.isOpen ? "rotate-180" : ""}`} />
      </button>

      {picker.isOpen && (
        <ul
          id={picker.listId}
          role="listbox"
          aria-label="Choose a theater"
          className="absolute right-0 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-lg border border-white/10 bg-neutral-900/95 py-1 shadow-xl backdrop-blur"
        >
          {vm.options.map((option) => (
            <li key={option.id} role="option" aria-selected={option.isSelected}>
              <button
                type="button"
                onClick={() => picker.choose(option.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/5 focus-visible:bg-white/10 focus-visible:outline-none"
              >
                <Icon name="pin" className={`h-4 w-4 shrink-0 ${option.isSelected ? "text-marquee-400" : "text-neutral-500"}`} />
                <span className="flex flex-col">
                  <span className={`text-sm ${option.isSelected ? "font-medium text-white" : "text-neutral-200"}`}>{option.name}</span>
                  <span className="text-xs text-neutral-500">{option.city}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
