# Marquee Cinemas — Online Seat Booking

Customers can browse showings, pick seats, and book them. The guarantee that
matters most: **the same seat can never be sold twice for the same showing.**

## Stack

- **Next.js (App Router) + TypeScript**: UI and API in one app
- **Postgres**: transactions and row-level locking; a unique constraint backs up the no-double-sell rule
- **Drizzle ORM**: typed schema and migrations; the booking path uses explicit, parameterized SQL
- **Zod**: validates every API input
- **Tailwind CSS**
- **Vitest**: includes a concurrency test that races many requests for the same seat

## Getting started

Requires Node 22+ and Docker.

```bash
cp .env.example .env
npm install
npm run db:up        # start Postgres in Docker
npm run db:generate  # generate SQL migrations from the schema
npm run db:migrate   # apply them
npm run db:seed      # demo locations, films and showings
npm run dev          # http://localhost:3000
npm test             # concurrency tests (needs the database running)
```

Health check: `GET /api/health`

## How double-selling is prevented

The flow is **hold → confirm**. Picking seats creates a short hold (8 minutes by
default) so nobody can take them during checkout; confirming turns the hold into
a booking. All seat changes live in `src/server/booking.ts`.

1. **Row locks in a fixed order.** Each change runs in a transaction that locks the
   requested `showing_seats` rows with `SELECT … FOR UPDATE`, ordered by seat id.
   Concurrent requests for the same seat queue up instead of racing, and the fixed
   order prevents deadlocks between overlapping multi-seat requests.
2. **Conditional updates, checked.** The `UPDATE` repeats its preconditions
   (seat available, or its hold expired) and the affected row count must match.
   Multi-seat requests are all-or-nothing.
3. **Database backstop.** `booking_seats` has `UNIQUE (showing_id, seat_id)`, so
   Postgres itself rejects a second sale of a seat, even if the code above had a bug.
4. **Idempotent confirm.** One booking per hold (`bookings.hold_id` is unique), so a
   retried or double-clicked confirm returns the same booking instead of a second one.
5. **Lazy expiry.** An expired hold counts as available inside the queries
   themselves; correctness never depends on a background cleanup job.

`tests/booking.concurrency.test.ts` proves it against a real Postgres: 100
simultaneous requests for one seat produce exactly one hold; 60 overlapping
multi-seat requests never share a seat or deadlock; 20 parallel confirms create
one booking; and a direct duplicate insert is rejected by the constraint.

## Decisions and assumptions

_To be written._

## Questions for Marquee (Dana and Marcus)

_To be written._

## What I'd do next for production

_To be written._
