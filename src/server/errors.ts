/** Domain errors raised by the booking service. API routes map them to HTTP statuses. */

export class BookingError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** One or more requested seats are taken (or don't belong to the showing). 409 */
export class SeatConflictError extends BookingError {
  constructor(readonly seatIds: string[]) {
    super("Some of those seats were just taken.", 409, "SEAT_CONFLICT");
  }
}

/**
 * The visitor already holds seats for the maximum number of showings. 429
 * Stops one browser from tying up a sell-out showing's seats during checkout.
 */
export class HoldLimitError extends BookingError {
  constructor(readonly limit: number) {
    super(
      `You already have seats held for ${limit} other showings. Finish or cancel one of those checkouts first.`,
      429,
      "HOLD_LIMIT",
    );
  }
}

/** This client sent far too many booking requests and is blocked for a while. 429 */
export class TooManyRequestsError extends BookingError {
  constructor(readonly retryAfterSeconds: number) {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    super(
      `Too many booking attempts from your network. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      429,
      "RATE_LIMITED",
    );
  }
}

/** The hold doesn't exist or belongs to another session. 404 */
export class HoldNotFoundError extends BookingError {
  constructor() {
    super("Hold not found.", 404, "HOLD_NOT_FOUND");
  }
}

/** The hold lapsed before it was confirmed, so its seats may have been resold. 410 */
export class HoldExpiredError extends BookingError {
  constructor() {
    super("Your hold expired. Please pick your seats again.", 410, "HOLD_EXPIRED");
  }
}

/** The showing doesn't exist or has already started. 404 / 409 */
export class ShowingUnavailableError extends BookingError {
  constructor(reason: "not_found" | "started") {
    super(
      reason === "not_found" ? "Showing not found." : "This showing has already started.",
      reason === "not_found" ? 404 : 409,
      reason === "not_found" ? "SHOWING_NOT_FOUND" : "SHOWING_STARTED",
    );
  }
}

/** Postgres unique_violation (23505), unwrapping Drizzle's error wrapper if present. */
export function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 3 && e; i++) {
    if (typeof e === "object" && e !== null && (e as { code?: unknown }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

/** Ticket choices don't match the hold's seats, or name an unknown ticket type. 400 */
/** The discount code doesn't exist, is switched off, expired or used up. 422 */
export class InvalidDiscountError extends BookingError {
  constructor() {
    super("That discount code isn't valid.", 422, "DISCOUNT_INVALID");
  }
}

export class InvalidTicketsError extends BookingError {
  constructor() {
    super("Those ticket choices don't match your seats. Please try again.", 400, "INVALID_TICKETS");
  }
}
