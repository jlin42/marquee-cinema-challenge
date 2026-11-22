"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { focusRing } from "@/components/ui/icon-button";

/** View: "Have a discount code?" → code input with Apply; once applied, a removable chip. */
export function DiscountField({
  applied,
  error,
  isChecking,
  onApply,
  onRemove,
}: {
  applied: { code: string; label: string } | null;
  error: string | null;
  isChecking: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
}) {
  const [isOpen, setOpen] = useState(false);
  const [code, setCode] = useState("");

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-marquee-400/30 bg-marquee-500/10 px-3 py-2.5 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <Icon name="tag" className="h-4 w-4 shrink-0 text-marquee-400" />
          <span className="font-mono font-semibold text-white">{applied.code}</span>
          <span className="truncate text-neutral-300">{applied.label}</span>
        </span>
        <button type="button" onClick={onRemove} className={`shrink-0 text-xs text-neutral-300 underline underline-offset-2 hover:text-white ${focusRing}`}>
          Remove
        </button>
      </div>
    );
  }

  if (!isOpen && !error) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 self-start text-sm text-neutral-300 underline underline-offset-4 hover:text-white ${focusRing}`}
      >
        <Icon name="tag" className="h-4 w-4" />
        Have a discount code?
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label htmlFor="discount-code" className="font-medium text-neutral-200">
        Discount code
      </label>
      <div className="flex gap-2">
        <input
          id="discount-code"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // apply the code, don't submit the booking
              onApply(code);
            }
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "discount-error" : undefined}
          placeholder="Enter code"
          className={`min-w-0 flex-1 rounded-lg border bg-neutral-950 px-3 py-2.5 font-mono uppercase tracking-wider text-white placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-neutral-600 focus:outline-none ${
            error ? "border-red-400/70 focus:border-red-400" : "border-white/15 focus:border-marquee-400"
          }`}
        />
        <button
          type="button"
          onClick={() => onApply(code)}
          disabled={!code.trim() || isChecking}
          className={`shrink-0 rounded-lg border border-white/15 px-4 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-40 ${focusRing}`}
        >
          {isChecking ? "Checking…" : "Apply"}
        </button>
      </div>
      {error && (
        <p id="discount-error" role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
