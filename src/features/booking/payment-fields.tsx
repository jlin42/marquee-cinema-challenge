"use client";

import { Icon } from "@/components/ui/icon";
import type { CardField, useMockCard } from "./use-mock-card";

type MockCard = ReturnType<typeof useMockCard>;

/**
 * View: demo card form, styled like a provider's hosted card element (one grouped box:
 * number, then expiry and CVC side by side) so swapping in the real thing changes little.
 */
export function PaymentFields({ card }: { card: MockCard }) {
  const numberError = card.errorFor("number");
  const expiryError = card.errorFor("expiry");
  const cvcError = card.errorFor("cvc");
  const postalError = card.errorFor("postal");
  const cardErrors = [numberError, expiryError, cvcError].filter(Boolean);

  const cell = (error?: string) =>
    `w-full bg-transparent px-3 py-2.5 text-white placeholder:text-neutral-600 focus:relative focus:z-10 focus:outline-none focus:ring-2 focus:ring-inset ${
      error ? "focus:ring-red-400" : "focus:ring-marquee-400"
    }`;

  const input = (field: CardField, props: React.InputHTMLAttributes<HTMLInputElement>, error?: string) => (
    <input
      {...props}
      value={card.values[field]}
      onChange={(e) => card.set(field, e.target.value)}
      onBlur={() => card.blur(field)}
      inputMode="numeric"
      // A mock form should never be offered someone's saved real card. (The provider's
      // hosted fields handle card autofill in production, over HTTPS.)
      autoComplete="off"
      data-1p-ignore
      data-lpignore="true"
      aria-invalid={error ? true : undefined}
      className={`${cell(error)} ${error ? "text-red-200" : ""}`}
    />
  );

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <Icon name="lock" className="h-4 w-4 text-neutral-400" />
        Payment
      </legend>

      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-neutral-200" id="card-label">Card information</span>
        <div
          role="group"
          aria-labelledby="card-label"
          className={`overflow-hidden rounded-lg border bg-neutral-950 ${cardErrors.length ? "border-red-400/70" : "border-white/15"}`}
        >
          <div className="relative border-b border-white/10">
            {input("number", { "aria-label": "Card number", name: "demo-card-number", placeholder: "1234 1234 1234 1234" }, numberError)}
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1.5 text-xs font-semibold text-neutral-400">
              {card.brand ?? <Icon name="card" className="h-5 w-5 text-neutral-600" />}
            </span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-white/10">
            {input("expiry", { "aria-label": "Expiry date (MM / YY)", name: "demo-card-expiry", placeholder: "MM / YY" }, expiryError)}
            {input("cvc", { "aria-label": "Security code (CVC)", name: "demo-card-cvc", placeholder: "CVC" }, cvcError)}
          </div>
        </div>
        {cardErrors.length > 0 && (
          <p role="alert" className="text-xs text-red-300">
            {cardErrors[0]}
          </p>
        )}
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-neutral-200">Billing ZIP code</span>
        <span className={`overflow-hidden rounded-lg border bg-neutral-950 ${postalError ? "border-red-400/70" : "border-white/15"}`}>
          {input("postal", { name: "demo-postal-code", placeholder: "23219" }, postalError)}
        </span>
        {postalError && <span className="text-xs text-red-300">{postalError}</span>}
      </label>

      <p className="text-xs text-neutral-500">Demo only: no card is charged and details never leave your browser.</p>
    </fieldset>
  );
}
