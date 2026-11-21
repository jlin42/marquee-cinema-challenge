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
  seatIds: string[];
  tickets: { seatId: string; ticketType: TicketCode; priceCents: number; feeCents: number }[];
  totalCents: number;
  createdAt: string;
};
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

  /** `tickets` maps seat id → ticket type; the server sets the prices. */
  confirm: (holdId: string, email: string, tickets: Record<string, TicketCode>) =>
    request<{ booking: ApiBooking }>(`/api/holds/${holdId}/confirm`, {
      method: "POST",
      body: JSON.stringify({ email, tickets }),
    }),
};
