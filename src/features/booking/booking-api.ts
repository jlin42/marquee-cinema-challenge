/**
 * Client-side access to the booking API (the Model, as seen from the browser).
 * Every call returns a typed result instead of throwing, so the view model can
 * handle each outcome explicitly.
 */
import type { ApiSeat } from "./seat-model";

export type ApiHold = { id: string; showingId: string; seatIds: string[]; expiresAt: string };
export type TicketCode = "general" | "child" | "senior";
export type ApiBooking = {
  id: string;
  email: string;
  customerName: string | null;
  seatIds: string[];
  tickets: { seatId: string; ticketType: TicketCode; priceCents: number; feeCents: number }[];
  totalCents: number;
  discountCode: string | null;
  discountCents: number;
  confirmationCode: string;
  createdAt: string;
};
export type ApiDiscount = { code: string; description: string; percentOff: number };
export type ApiError = { code: string; message: string; seatIds?: string[] };

export type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiError };

async function request<T>(url: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      cache: "no-store",
    });
    if (res.status === 204) return { ok: true, data: undefined as T };
    const body = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: body as T };
    return {
      ok: false,
      status: res.status,
      error: body?.error ?? { code: "INTERNAL", message: "Something went wrong. Please try again." },
    };
  } catch {
    return { ok: false, status: 0, error: { code: "NETWORK", message: "You appear to be offline. Please try again." } };
  }
}

export const bookingApi = {
  fetchSeats: (showingId: string) =>
    request<{ seats: ApiSeat[]; hold: ApiHold | null }>(`/api/showings/${showingId}`),

  hold: (showingId: string, seatIds: string[]) =>
    request<{ hold: ApiHold }>("/api/holds", { method: "POST", body: JSON.stringify({ showingId, seatIds }) }),

  release: (holdId: string) => request<void>(`/api/holds/${holdId}`, { method: "DELETE" }),

  /** Preview a discount code (the server applies it again when booking). */
  checkDiscount: (code: string) =>
    request<{ discount: ApiDiscount }>("/api/discounts/check", { method: "POST", body: JSON.stringify({ code }) }),

  /**
   * `tickets` maps seat id → ticket type; the server sets the prices and applies the
   * discount. No card details are sent (the payment is mocked in the browser).
   */
  confirm: (
    holdId: string,
    booker: { name: string; email: string },
    tickets: Record<string, TicketCode>,
    discountCode?: string,
  ) =>
    request<{ booking: ApiBooking }>(`/api/holds/${holdId}/confirm`, {
      method: "POST",
      body: JSON.stringify({ ...booker, tickets, discountCode }),
    }),
};
