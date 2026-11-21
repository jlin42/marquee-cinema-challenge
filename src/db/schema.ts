import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------- Venue ----------

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  city: text("city").notNull(),
});

export const screens = pgTable("screens", {
  id: uuid("id").primaryKey().defaultRandom(),
  locationId: uuid("location_id")
    .notNull()
    .references(() => locations.id),
  name: text("name").notNull(),
});

export const seatType = pgEnum("seat_type", ["standard", "wheelchair", "companion"]);

export const seats = pgTable(
  "seats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    screenId: uuid("screen_id")
      .notNull()
      .references(() => screens.id),
    rowLabel: text("row_label").notNull(),
    number: integer("number").notNull(),
    type: seatType("type").notNull().default("standard"),
    // Grid position for rendering the seat map (allows aisles/gaps).
    x: integer("x").notNull(),
    y: integer("y").notNull(),
  },
  (t) => [uniqueIndex("seats_screen_row_number_uq").on(t.screenId, t.rowLabel, t.number)],
);

// ---------- Programming ----------

export const films = pgTable("films", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  runtimeMinutes: integer("runtime_minutes").notNull(),
  rating: text("rating"),
});

export const showings = pgTable(
  "showings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    screenId: uuid("screen_id")
      .notNull()
      .references(() => screens.id),
    filmId: uuid("film_id")
      .notNull()
      .references(() => films.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("showings_starts_at_idx").on(t.startsAt)],
);

// ---------- Inventory, holds, bookings ----------

export const seatStatus = pgEnum("seat_status", ["available", "held", "booked"]);

export const holds = pgTable("holds", {
  id: uuid("id").primaryKey().defaultRandom(),
  showingId: uuid("showing_id")
    .notNull()
    .references(() => showings.id),
  // The browser session that owns this hold (random token in an httpOnly cookie).
  sessionId: text("session_id").notNull(),
  // The seats this hold was created for; confirm must still own every one.
  seatIds: uuid("seat_ids").array().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  showingId: uuid("showing_id")
    .notNull()
    .references(() => showings.id),
  // One booking per hold: the hold id doubles as the idempotency key, so a
  // retried or double-clicked confirm returns the same booking.
  holdId: uuid("hold_id")
    .notNull()
    .unique()
    .references(() => holds.id),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per seat per showing. Seat state changes happen here through
 * atomic conditional UPDATEs (see the booking service).
 */
export const showingSeats = pgTable(
  "showing_seats",
  {
    showingId: uuid("showing_id")
      .notNull()
      .references(() => showings.id),
    seatId: uuid("seat_id")
      .notNull()
      .references(() => seats.id),
    status: seatStatus("status").notNull().default("available"),
    holdId: uuid("hold_id").references(() => holds.id),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    bookingId: uuid("booking_id").references(() => bookings.id),
  },
  (t) => [
    primaryKey({ columns: [t.showingId, t.seatId] }),
    index("showing_seats_hold_id_idx").on(t.holdId),
  ],
);

/**
 * Backstop for the core invariant: a seat can be sold at most once per
 * showing, enforced by the database regardless of application logic.
 */
export const bookingSeats = pgTable(
  "booking_seats",
  {
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    showingId: uuid("showing_id")
      .notNull()
      .references(() => showings.id),
    seatId: uuid("seat_id")
      .notNull()
      .references(() => seats.id),
  },
  (t) => [uniqueIndex("booking_seats_showing_seat_uq").on(t.showingId, t.seatId)],
);
