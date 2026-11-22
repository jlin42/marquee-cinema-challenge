"use client";

import { useState } from "react";

/**
 * ViewModel for the demo card form: formatting and validation only. Card details stay in
 * this component's memory and are never sent anywhere.
 *
 * Production: replace the whole form with the payment provider's hosted fields (e.g.
 * Stripe's Payment Element), which collect the card in their own iframe and give us a
 * token. Card numbers then never touch our servers, which keeps PCI scope minimal.
 */
export type CardField = "number" | "expiry" | "cvc" | "postal";

const digits = (s: string) => s.replace(/\D/g, "");

export function cardBrand(number: string): "Visa" | "Mastercard" | "Amex" | "Discover" | null {
  const n = digits(number);
  if (/^4/.test(n)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^6(011|5)/.test(n)) return "Discover";
  return null;
}

/** Luhn checksum, the check digit every real card number has. */
export function passesLuhn(number: string) {
  const n = digits(number);
  let sum = 0;
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return n.length >= 13 && sum % 10 === 0;
}

function formatNumber(value: string) {
  const n = digits(value);
  if (cardBrand(n) === "Amex") return n.slice(0, 15).replace(/^(\d{1,4})(\d{1,6})?(\d{1,5})?$/, (_, a, b, c) => [a, b, c].filter(Boolean).join(" "));
  return n.slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value: string, previous: string) {
  let n = digits(value).slice(0, 4);
  if (n.length === 1 && Number(n) > 1) n = `0${n}`; // "5" → "05"
  const deleting = value.length < previous.length;
  if (n.length >= 3 || (n.length === 2 && !deleting)) return `${n.slice(0, 2)} / ${n.slice(2)}`;
  return n;
}

export function validateCard(card: Record<CardField, string>, now = new Date()): Partial<Record<CardField, string>> {
  const errors: Partial<Record<CardField, string>> = {};
  if (!passesLuhn(card.number)) errors.number = "Your card number is incomplete or invalid.";

  const [mm, yy] = card.expiry.split("/").map((p) => Number(digits(p)));
  const month = mm ?? 0;
  const year = 2000 + (yy ?? 0);
  const expired = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
  if (!(month >= 1 && month <= 12) || digits(card.expiry).length !== 4) errors.expiry = "Enter a valid expiry date.";
  else if (expired) errors.expiry = "This card has expired.";

  const cvcLength = cardBrand(card.number) === "Amex" ? 4 : 3;
  if (digits(card.cvc).length !== cvcLength) errors.cvc = `Enter the ${cvcLength}-digit security code.`;
  if (!/^\d{5}$/.test(card.postal)) errors.postal = "Enter a 5-digit ZIP code.";
  return errors;
}

export function useMockCard() {
  const [card, setCard] = useState<Record<CardField, string>>({ number: "", expiry: "", cvc: "", postal: "" });
  const [touched, setTouched] = useState<Partial<Record<CardField, boolean>>>({});
  const errors = validateCard(card);

  const set = (field: CardField, value: string) =>
    setCard((c) => ({
      ...c,
      [field]:
        field === "number"
          ? formatNumber(value)
          : field === "expiry"
            ? formatExpiry(value, c.expiry)
            : field === "cvc"
              ? digits(value).slice(0, 4)
              : digits(value).slice(0, 5),
    }));

  return {
    values: card,
    brand: cardBrand(card.number),
    /** Errors are shown once a field has been left, or after a submit attempt. */
    errorFor: (field: CardField) => (touched[field] ? errors[field] : undefined),
    set,
    blur: (field: CardField) => setTouched((t) => ({ ...t, [field]: true })),
    /** Marks every field touched (shows errors) and reports whether the card is valid. */
    validate: () => {
      setTouched({ number: true, expiry: true, cvc: true, postal: true });
      return Object.keys(errors).length === 0;
    },
  };
}
