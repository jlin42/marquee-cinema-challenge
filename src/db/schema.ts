import {
  boolean,
  jsonb,
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
import { sql } from "drizzle-orm";

// ---------- Venue ----------

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  // Full street address, shown when confirming the theater before booking.
  address: text("address"),
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
  slug: text("slug").unique(),
  title: text("title").notNull(),
  runtimeMinutes: integer("runtime_minutes").notNull(),
  rating: text("rating"),
  genre: text("genre"),
  tagline: text("tagline"),
  synopsis: text("synopsis"),
  // URL of the wide backdrop image (public/ for the demo; object storage + CDN in production).
  backdropUrl: text("backdrop_url"),
  // Position in the home-page carousel; null = not featured.
  featuredRank: integer("featured_rank"),
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

// ---------- Pricing ----------

export const ticketType = pgEnum("ticket_type", ["general", "child", "senior"]);

/** Price list. Prices are in cents; the fee is charged per ticket. */
export const ticketTypes = pgTable("ticket_types", {
  code: ticketType("code").primaryKey(),
  label: text("label").notNull(),
  description: text("description"), // e.g. "3–11 years"
  priceCents: integer("price_cents").notNull(),
  feeCents: integer("fee_cents").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

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

/**
 * Discount codes, applied at checkout to the whole order (tickets and fees).
 * Codes are stored uppercase; redemptions are counted inside the booking transaction.
 */
export const discountCodes = pgTable("discount_codes", {
  code: text("code").primaryKey(),
  description: text("description").notNull(), // shown to the customer, e.g. "Staff comp"
  percentOff: integer("percent_off").notNull(), // 1–100; 100 makes the order free
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  maxRedemptions: integer("max_redemptions"), // null = unlimited
  redemptions: integer("redemptions").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookingStatus = pgEnum("booking_status", ["active", "cancelled"]);

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
  // Name of the main ticket booker.
  customerName: text("customer_name"),
  // Total charged (all tickets plus fees, minus any discount), fixed at booking time.
  totalCents: integer("total_cents").notNull().default(0),
  // Code printed on the ticket and encoded in its QR, e.g. "MQ7F3A2D9C41B0". Generated by
  // the database so every insert path (checkout, seed, tests) gets one.
  confirmationCode: text("confirmation_code")
    .notNull()
    .unique()
    // 12 hex digits (48 bits): collisions stay negligible even across millions of bookings.
    .default(sql`'MQ' || upper(substr(md5(gen_random_uuid()::text), 1, 12))`),
  // Discount applied, if any (totalCents is already net of it).
  discountCode: text("discount_code").references(() => discountCodes.code),
  discountCents: integer("discount_cents").notNull().default(0),
  // Cancelled bookings are kept for history; their seats are released.
  status: bookingStatus("status").notNull().default("active"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
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
    // Who-booked-this-seat lookups (staff dashboard), and fast deletes/cancels of bookings
    // (the foreign key check from bookings scans this column).
    index("showing_seats_booking_id_idx").on(t.bookingId),
  ],
);

/**
 * Backstop for the core invariant: a seat can have at most one active sale per
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
    // What this ticket was sold as, and the price paid (a snapshot: later price changes don't rewrite it).
    ticketType: ticketType("ticket_type").notNull().default("general"),
    priceCents: integer("price_cents").notNull().default(0),
    feeCents: integer("fee_cents").notNull().default(0),
    // Set when the seat is given up (booking cancelled or moved); the row stays as history.
    releasedAt: timestamp("released_at", { withTimezone: true }),
  },
  // Backstop: at most one *active* sale per seat per showing. Released rows don't count,
  // so a cancelled or moved seat can be sold again.
  (t) => [
    uniqueIndex("booking_seats_active_showing_seat_uq")
      .on(t.showingId, t.seatId)
      .where(sql`${t.releasedAt} IS NULL`),
  ],
);

// ---------- Staff ----------

export const staffRole = pgEnum("staff_role", ["admin", "privileged", "viewer"]);

/** Staff accounts for the /staff site. Passwords are stored only as scrypt hashes. */
export const staffUsers = pgTable(
  "staff_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Sign-in name, e.g. "JerryAdmin". Unique regardless of letter case.
    username: text("username").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: staffRole("role").notNull().default("viewer"),
    // Deactivated accounts can't sign in; their sessions are revoked.
    isActive: boolean("is_active").notNull().default(true),
    // Lockout after repeated failed logins.
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("staff_users_username_ci_uq").on(sql`lower(${t.username})`)],
);

/**
 * Server-side staff sessions. The cookie holds a random token; only its SHA-256
 * hash is stored, so a database leak doesn't expose usable session tokens.
 */
export const staffSessions = pgTable(
  "staff_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    staffUserId: uuid("staff_user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("staff_sessions_user_idx").on(t.staffUserId)],
);

// ---------- Audit log ----------

export const staffActionType = pgEnum("staff_action_type", [
  "booking.cancel",
  "booking.move",
  "staff.role_change",
  "staff.deactivate",
  "staff.activate",
]);

/** Every write action taken by a staff member: who, what, when, and the details. Append-only. */
export const staffActions = pgTable(
  "staff_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffUserId: uuid("staff_user_id")
      .notNull()
      .references(() => staffUsers.id),
    action: staffActionType("action").notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id),
    targetStaffUserId: uuid("target_staff_user_id").references(() => staffUsers.id),
    summary: text("summary").notNull(), // human-readable, e.g. "Cancelled booking 3F9A21C0 (Maya Carter, 2 seats)"
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("staff_actions_user_created_idx").on(t.staffUserId, t.createdAt),
    index("staff_actions_created_idx").on(t.createdAt),
  ],
);

// ---------- Abuse protection ----------

/**
 * Booking requests per client (IP) per one-minute window. Rows older than a few
 * minutes are pruned as requests come in.
 */
export const requestCounters = pgTable(
  "request_counters",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/**
 * Temporary blocks for clients that hammered the booking endpoints. `strikes` makes
 * each repeat block longer.
 */
export const ipBlocks = pgTable("ip_blocks", {
  ip: text("ip").primaryKey(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }).notNull(),
  strikes: integer("strikes").notNull().default(1),
  lastBlockedAt: timestamp("last_blocked_at", { withTimezone: true }).notNull().defaultNow(),
});
