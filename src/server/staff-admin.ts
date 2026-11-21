/**
 * Admin actions on staff accounts, and the audit log. Every change is audited in the
 * same transaction. No framework imports, so the seed can use it too.
 *
 * Safety rails: admins can't change their own role or deactivate themselves, and there is
 * always at least one active admin afterwards (no lock-out).
 */
import { and, asc, count, desc, eq, inArray, max, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { staffActions, staffSessions, staffUsers } from "@/db/schema";
import { ROLE_LABEL, type StaffRole } from "./permissions";

export type AdminResult = { ok: true } | { ok: false; message: string };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A rule broke mid-batch: thrown to roll the whole transaction back. */
class AdminRuleError extends Error {}

export type StaffChange = { targetId: string; role?: StaffRole; active?: boolean };

/**
 * Apply an admin's reviewed batch of account changes in one transaction: every change
 * is made and audited, or none is. Target rows are locked in id order (no deadlocks
 * between two admins). The "at least one active admin" rule is checked on the final
 * state, so swapping admins within one batch works.
 */
export async function applyStaffChanges(input: { actorId: string; changes: StaffChange[]; at?: Date }): Promise<AdminResult> {
  const changes = [...new Map(input.changes.map((c) => [c.targetId, c])).values()];
  if (changes.length === 0) return { ok: true };
  for (const c of changes) {
    if (c.targetId !== input.actorId) continue;
    return { ok: false, message: c.role !== undefined ? "You can't change your own role." : "You can't deactivate your own account." };
  }
  const at = input.at ?? new Date();

  try {
    await db.transaction(async (tx) => {
      const ids = changes.map((c) => c.targetId).sort();
      const targets = await tx.select().from(staffUsers).where(inArray(staffUsers.id, ids)).orderBy(asc(staffUsers.id)).for("update");
      if (targets.length !== ids.length) throw new AdminRuleError("That account doesn't exist.");
      const byId = new Map(targets.map((t) => [t.id, t]));

      for (const change of changes) {
        const target = byId.get(change.targetId)!;
        if (change.role !== undefined && change.role !== target.role) await applyRole(tx, input.actorId, target, change.role, at);
        if (change.active !== undefined && change.active !== target.isActive) await applyActive(tx, input.actorId, target, change.active, at);
      }

      if ((await activeAdminCount(tx)) < 1) throw new AdminRuleError("There must always be at least one active admin.");
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AdminRuleError) return { ok: false, message: error.message };
    throw error;
  }
}

/** Change one account's role (single-change form of applyStaffChanges; the seed uses it). */
export function changeRole(input: { actorId: string; targetId: string; role: StaffRole; at?: Date }) {
  return applyStaffChanges({ actorId: input.actorId, changes: [{ targetId: input.targetId, role: input.role }], at: input.at });
}

/** Activate or deactivate one account (single-change form of applyStaffChanges). */
export function setActive(input: { actorId: string; targetId: string; active: boolean; at?: Date }) {
  return applyStaffChanges({ actorId: input.actorId, changes: [{ targetId: input.targetId, active: input.active }], at: input.at });
}

type StaffRow = typeof staffUsers.$inferSelect;

async function applyRole(tx: Tx, actorId: string, target: StaffRow, role: StaffRole, at: Date) {
  await tx.update(staffUsers).set({ role }).where(eq(staffUsers.id, target.id));
  await tx.delete(staffSessions).where(eq(staffSessions.staffUserId, target.id)); // re-sign-in with new rights
  await tx.insert(staffActions).values({
    staffUserId: actorId,
    action: "staff.role_change",
    targetStaffUserId: target.id,
    summary: `Changed ${target.username}'s role from ${ROLE_LABEL[target.role]} to ${ROLE_LABEL[role]}`,
    details: { from: target.role, to: role },
    createdAt: at,
  });
}

async function applyActive(tx: Tx, actorId: string, target: StaffRow, active: boolean, at: Date) {
  await tx.update(staffUsers).set({ isActive: active }).where(eq(staffUsers.id, target.id));
  if (!active) await tx.delete(staffSessions).where(eq(staffSessions.staffUserId, target.id));
  await tx.insert(staffActions).values({
    staffUserId: actorId,
    action: active ? "staff.activate" : "staff.deactivate",
    targetStaffUserId: target.id,
    summary: `${active ? "Reactivated" : "Deactivated"} ${target.username}`,
    details: {},
    createdAt: at,
  });
}

async function activeAdminCount(tx: Tx) {
  const [row] = await tx
    .select({ n: count() })
    .from(staffUsers)
    .where(and(eq(staffUsers.role, "admin"), eq(staffUsers.isActive, true)));
  return row?.n ?? 0;
}

/** All staff accounts with how many actions each has taken and when they last acted. */
export async function listStaffWithActivity() {
  return db
    .select({
      id: staffUsers.id,
      username: staffUsers.username,
      name: staffUsers.name,
      role: staffUsers.role,
      isActive: staffUsers.isActive,
      actionCount: count(staffActions.id),
      lastActionAt: max(staffActions.createdAt),
    })
    .from(staffUsers)
    .leftJoin(staffActions, eq(staffActions.staffUserId, staffUsers.id))
    .groupBy(staffUsers.id)
    .orderBy(sql`case ${staffUsers.role} when 'admin' then 0 when 'privileged' then 1 else 2 end`, staffUsers.username);
}

/** Newest-first audit entries, optionally for one staff member. */
export async function listActions(options: { staffUserId?: string; limit?: number } = {}) {
  return db
    .select({
      id: staffActions.id,
      action: staffActions.action,
      summary: staffActions.summary,
      createdAt: staffActions.createdAt,
      actor: staffUsers.username,
      actorId: staffUsers.id,
    })
    .from(staffActions)
    .innerJoin(staffUsers, eq(staffUsers.id, staffActions.staffUserId))
    .where(options.staffUserId ? eq(staffActions.staffUserId, options.staffUserId) : undefined)
    .orderBy(desc(staffActions.createdAt))
    .limit(options.limit ?? 100);
}
