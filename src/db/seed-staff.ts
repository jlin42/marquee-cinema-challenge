/**
 * Demo staff accounts and their action history.
 *
 * Accounts: 2 admins, 10 privileged, 30 viewers (final state). The first admin comes from
 * STAFF_ADMIN_USERNAME / STAFF_ADMIN_PASSWORD in .env (gitignored); every other account
 * shares STAFF_DEMO_PASSWORD, or a generated password that is printed once. Only scrypt
 * hashes are stored, and no credentials live in the repo.
 *
 * History: role changes, a deactivate/reactivate, and a few hundred booking cancellations
 * and seat moves. They run through the real services (booking-admin.ts, staff-admin.ts)
 * with past timestamps, so the bookings, seats and audit log are consistent with each
 * other exactly as if staff had done them on the site.
 */
import { randomBytes } from "node:crypto";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { bookingSeats, bookings, seats, showingSeats, showings, staffUsers } from "./schema";
import { hashPassword } from "../server/passwords";
import { cancelBooking, moveBooking } from "../server/booking-admin";
import { changeRole, setActive } from "../server/staff-admin";
import type { StaffRole } from "../server/permissions";
import type { Random } from "./seed-bookings";

const FIRST = ["Alex", "Bianca", "Caleb", "Dev", "Erin", "Felix", "Gina", "Hector", "Ivy", "Jamal", "Kara", "Liam", "Mina", "Nate", "Olivia", "Paul", "Quinn", "Rosa", "Sam", "Tara", "Uma", "Victor", "Wes", "Ximena", "Yusuf", "Zara", "Ben", "Cora", "Dylan", "Esme", "Finn", "Gwen", "Hugo", "Iris", "Jon", "Kemi", "Luca", "Mae", "Nico", "Opal", "Reid"];
const LAST = ["Abbott", "Bishop", "Castillo", "Dalton", "Ellis", "Fischer", "Graham", "Holloway", "Ingram", "Jensen", "Keller", "Lowry", "Mercer", "Novak", "Osei", "Pruitt", "Quint", "Ramsey", "Sutton", "Thorne", "Underwood", "Vance", "Whitfield", "Yates"];

/** Initial roles; history later promotes two viewers, giving 10 privileged / 30 viewers. */
const INITIAL = { privileged: 8, viewer: 32 } as const;
const CANCELLATIONS = 200;
const MOVES = 120;
const HISTORY_DAYS = 20;

type Account = { id: string; username: string; role: StaffRole };

export type SeededStaff = { adminUsername: string; adminPassword: string | null; demoPassword: string | null; counts: Record<StaffRole, number>; actions: number };

export async function seedStaff(random: Random): Promise<SeededStaff> {
  const adminUsername = process.env.STAFF_ADMIN_USERNAME || "admin";
  const adminPassword = process.env.STAFF_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
  const demoPassword = process.env.STAFF_DEMO_PASSWORD || randomBytes(9).toString("base64url");
  const demoHash = await hashPassword(demoPassword); // one hash for all demo accounts (fresh salt per seed)

  const names = uniqueNames(random, 1 + INITIAL.privileged + INITIAL.viewer);
  const rows = [
    { username: adminUsername, name: adminUsername, passwordHash: await hashPassword(adminPassword), role: "admin" as const },
    { ...toAccount(names[0]!), passwordHash: demoHash, role: "admin" as const },
    ...names.slice(1, 1 + INITIAL.privileged).map((n) => ({ ...toAccount(n), passwordHash: demoHash, role: "privileged" as const })),
    ...names.slice(1 + INITIAL.privileged).map((n) => ({ ...toAccount(n), passwordHash: demoHash, role: "viewer" as const })),
  ];
  const accounts: Account[] = await db
    .insert(staffUsers)
    .values(rows.map((r, i) => ({ ...r, createdAt: daysAgo(HISTORY_DAYS + 10 - i * 0.1) })))
    .returning({ id: staffUsers.id, username: staffUsers.username, role: staffUsers.role });

  const actions = await seedHistory(random, accounts);

  const final = await db.select({ role: staffUsers.role }).from(staffUsers);
  const counts = { admin: 0, privileged: 0, viewer: 0 };
  for (const r of final) counts[r.role]++;
  return {
    adminUsername,
    adminPassword: process.env.STAFF_ADMIN_PASSWORD ? null : adminPassword,
    demoPassword: process.env.STAFF_DEMO_PASSWORD ? null : demoPassword,
    counts,
    actions,
  };
}

async function seedHistory(random: Random, accounts: Account[]): Promise<number> {
  const admins = accounts.filter((a) => a.role === "admin");
  const privileged = accounts.filter((a) => a.role === "privileged");
  const viewers = accounts.filter((a) => a.role === "viewer");
  const [lead, second] = admins as [Account, Account];
  let done = 0;
  const ok = (r: { ok: boolean }) => (r.ok ? done++ : undefined);

  // Account changes, oldest first.
  const [promoteA, promoteB, flaky] = [viewers[0]!, viewers[1]!, viewers[2]!];
  const demoted = privileged[privileged.length - 1]!;
  ok(await changeRole({ actorId: lead.id, targetId: promoteA.id, role: "privileged", at: daysAgo(18.6) }));
  ok(await setActive({ actorId: second.id, targetId: flaky.id, active: false, at: daysAgo(16.2) }));
  ok(await changeRole({ actorId: second.id, targetId: demoted.id, role: "viewer", at: daysAgo(12.4) }));
  ok(await changeRole({ actorId: lead.id, targetId: promoteB.id, role: "privileged", at: daysAgo(9.1) }));
  ok(await setActive({ actorId: lead.id, targetId: flaky.id, active: true, at: daysAgo(6.8) }));
  ok(await changeRole({ actorId: lead.id, targetId: demoted.id, role: "privileged", at: daysAgo(3.3) }));

  // Booking work: privileged staff do most of it, admins some. Uneven weights look real.
  const actors = [...privileged, promoteA, promoteB, ...admins];
  const weights = actors.map((a) => (a.role === "admin" ? 0.6 : random.between(0.3, 2.5)));
  const pickActor = () => {
    let r = random.next() * weights.reduce((s, w) => s + w, 0);
    for (let i = 0; i < actors.length; i++) if ((r -= weights[i]!) <= 0) return actors[i]!;
    return actors[0]!;
  };

  const candidates = await db
    .select({ id: bookings.id, showingId: bookings.showingId, filmId: showings.filmId, screenId: showings.screenId, startsAt: showings.startsAt })
    .from(bookings)
    .innerJoin(showings, eq(showings.id, bookings.showingId))
    .where(and(eq(bookings.status, "active"), gt(showings.startsAt, new Date(Date.now() + 3 * 3_600_000))))
    .orderBy(asc(bookings.id));
  const pool = shuffle(random, candidates).slice(0, CANCELLATIONS + MOVES * 2);

  const jobs = pool.map((b, i) => ({ booking: b, kind: i < CANCELLATIONS ? "cancel" : "move", at: daysAgo(random.between(0.05, HISTORY_DAYS - 1)) }));
  jobs.sort((a, b) => a.at.getTime() - b.at.getTime());

  let moves = 0;
  for (const job of jobs) {
    const actor = pickActor();
    if (job.kind === "cancel") {
      ok(await cancelBooking({ actorId: actor.id, bookingId: job.booking.id, at: job.at }));
    } else if (moves < MOVES) {
      const target = await chooseMoveTarget(random, job.booking);
      if (!target) continue;
      const result = await moveBooking({ actorId: actor.id, bookingId: job.booking.id, toShowingId: target.showingId, seatIds: target.seatIds, at: job.at });
      if (result.ok) moves++;
      ok(result);
    }
  }
  return done;
}

/**
 * A plausible move: mostly a different time of the same film on the same screen's
 * theater day, sometimes new seats in the same showing. Seats are a free run in one row.
 */
async function chooseMoveTarget(
  random: Random,
  booking: { id: string; showingId: string; filmId: string; screenId: string; startsAt: Date },
): Promise<{ showingId: string; seatIds: string[] } | null> {
  const size = (await db.select({ seatId: bookingSeats.seatId }).from(bookingSeats).where(and(eq(bookingSeats.bookingId, booking.id), sql`${bookingSeats.releasedAt} IS NULL`))).length;
  if (size === 0) return null;

  let showingId = booking.showingId;
  if (random.chance(0.7)) {
    const others = await db
      .select({ id: showings.id })
      .from(showings)
      .where(
        and(
          eq(showings.filmId, booking.filmId),
          eq(showings.screenId, booking.screenId),
          gt(showings.startsAt, new Date(Date.now() + 3 * 3_600_000)),
          sql`abs(extract(epoch from ${showings.startsAt} - ${booking.startsAt})) < 3 * 86400`,
          sql`${showings.id} <> ${booking.showingId}`,
        ),
      );
    if (others.length) showingId = random.pick(others).id;
  }

  const free = await db
    .select({ id: seats.id, row: seats.rowLabel, number: seats.number })
    .from(showingSeats)
    .innerJoin(seats, eq(seats.id, showingSeats.seatId))
    .where(and(eq(showingSeats.showingId, showingId), eq(showingSeats.status, "available"), inArray(seats.type, ["standard"])))
    .orderBy(asc(seats.rowLabel), asc(seats.number));

  // Every run of `size` consecutive free seats in one row; pick one at random.
  const runs: string[][] = [];
  for (let i = 0; i + size <= free.length; i++) {
    const run = free.slice(i, i + size);
    if (run.every((s, k) => s.row === run[0]!.row && s.number === run[0]!.number + k)) runs.push(run.map((s) => s.id));
  }
  return runs.length ? { showingId, seatIds: random.pick(runs) } : null;
}

function uniqueNames(random: Random, n: number) {
  const seen = new Set<string>();
  const out: { first: string; last: string }[] = [];
  while (out.length < n) {
    const first = random.pick(FIRST);
    const last = random.pick(LAST);
    const username = `${first[0]}${last}`.toLowerCase(); // usernames must be unique
    if (seen.has(username)) continue;
    seen.add(username);
    out.push({ first, last });
  }
  return out;
}

const toAccount = (n: { first: string; last: string }) => ({ username: `${n.first[0]}${n.last}`.toLowerCase(), name: `${n.first} ${n.last}` });

function shuffle<T>(random: Random, items: T[]) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random.next() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
