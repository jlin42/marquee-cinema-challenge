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
