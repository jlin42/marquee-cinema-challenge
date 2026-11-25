/**
 * Trust matrix: what each staff role may do. The single source of truth for staff
 * authorization; every staff page, query and action checks it on the server.
 *
 * | Permission         | admin | privileged | viewer  |
 * |--------------------|-------|------------|---------|
 * | dashboard.view     | yes   | yes        | yes     |
 * | customers.contact  | yes   | yes        | masked  |
 * | bookings.manage    | yes   | yes        | no      |  cancel / move bookings, Movies tab
 * | staff.manage       | yes   | no         | no      |  Admin tab: roles, activation
 * | audit.view         | yes   | no         | no      |  everyone's action history
 */
export type StaffRole = "admin" | "privileged" | "viewer";

export type Permission = "dashboard.view" | "customers.contact" | "bookings.manage" | "staff.manage" | "audit.view";

export const TRUST_MATRIX: Record<StaffRole, ReadonlySet<Permission>> = {
  admin: new Set(["dashboard.view", "customers.contact", "bookings.manage", "staff.manage", "audit.view"]),
  privileged: new Set(["dashboard.view", "customers.contact", "bookings.manage"]),
  viewer: new Set(["dashboard.view"]),
};

export const ROLE_LABEL: Record<StaffRole, string> = { admin: "Admin", privileged: "Privileged", viewer: "Viewer" };

export const can = (staff: { role: StaffRole }, permission: Permission) => TRUST_MATRIX[staff.role].has(permission);

/** "jane.doe12@example.com" → "j•••@example.com" for roles without customers.contact. */
export const maskEmail = (email: string) => {
  const [local, domain] = email.split("@");
  return local && domain ? `${local[0]}•••@${domain}` : "•••";
};
