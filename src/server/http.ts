import { z } from "zod";
import { BookingError, SeatConflictError } from "./errors";

/** Consistent JSON error shape: { error: { code, message, ...details } } */
export function errorResponse(status: number, code: string, message: string, details?: object) {
  return Response.json({ error: { code, message, ...details } }, { status });
}

/** Wraps a route handler: maps domain and validation errors to HTTP responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof BookingError) {
        const details = err instanceof SeatConflictError ? { seatIds: err.seatIds } : undefined;
        return errorResponse(err.status, err.code, err.message, details);
      }
      if (err instanceof z.ZodError) {
        return errorResponse(400, "INVALID_INPUT", "Invalid request.", { issues: err.issues });
      }
      if (err instanceof RangeError) {
        return errorResponse(400, "INVALID_INPUT", err.message);
      }
      console.error(err);
      return errorResponse(500, "INTERNAL", "Something went wrong. Please try again.");
    }
  };
}

/** Parse a JSON body with a Zod schema; a missing or malformed body is a 400. */
export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new RangeError("Request body must be valid JSON.");
  }
  return schema.parse(body);
}

export const Uuid = z.uuid();
