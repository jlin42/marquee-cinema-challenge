"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { focusRing } from "@/components/ui/icon-button";
import type { LocationPickerVM } from "./location-view-model";
import { useLocationPicker } from "./use-location-picker";

/**
 * View: phone-sized overflow menu. One button opens a panel with Movies and, where the
 * theater can be changed, the theater list. Hidden from the `sm` breakpoint up.
 */
export function MobileMenu({ picker: vm }: { picker: LocationPickerVM | null }) {
  const menu = useLocationPicker(vm?.options ?? []);

  return (
    <div ref={menu.rootRef} className="sm:hidden">
      <button
        type="button"
        aria-expanded={menu.isOpen}
        aria-controls={menu.listId}
        aria-label={menu.isOpen ? "Close menu" : "Open menu"}
        onClick={menu.toggle}
        className={`flex items-center rounded-md p-1.5 text-white transition hover:bg-white/10 ${focusRing}`}
      >
        <Icon name={menu.isOpen ? "x" : "menu"} className={`h-6 w-6 ${menu.isSaving ? "animate-pulse" : ""}`} />
      </button>

      {menu.isOpen && (
        <div
          id={menu.listId}
          className="absolute inset-x-0 top-full max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-y border-white/10 bg-neutral-950/95 shadow-2xl backdrop-blur"
        >
          <nav aria-label="Main">
            <Link
              href="/movies"
              onClick={menu.close}
              className="flex items-center justify-between px-5 py-4 text-base font-medium text-white transition hover:bg-white/5 focus-visible:bg-white/10 focus-visible:outline-none"
            >
              Movies
              <Icon name="chevron-right" className="h-5 w-5 text-neutral-500" />
            </Link>
          </nav>

          {vm && (
            <div className="border-t border-white/10 pb-2">
              <p className="px-5 pb-1 pt-4 text-xs font-medium uppercase tracking-widest text-neutral-500">Theater</p>
              <ul role="listbox" aria-label="Choose a theater">
                {vm.options.map((option) => (
                  <li key={option.id} role="option" aria-selected={option.isSelected}>
                    <button
                      type="button"
                      onClick={() => menu.choose(option.id)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-white/5 focus-visible:bg-white/10 focus-visible:outline-none"
                    >
                      <Icon name="pin" className={`h-4 w-4 shrink-0 ${option.isSelected ? "text-marquee-400" : "text-neutral-600"}`} />
                      <span className="flex flex-1 flex-col">
                        <span className={`text-sm ${option.isSelected ? "font-medium text-white" : "text-neutral-200"}`}>{option.name}</span>
                        <span className="text-xs text-neutral-500">{option.city}</span>
                      </span>
                      {option.isSelected && <Icon name="check" className="h-4 w-4 text-marquee-400" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
