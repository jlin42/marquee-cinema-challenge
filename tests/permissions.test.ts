import { describe, expect, it } from "vitest";
import { can, maskEmail, TRUST_MATRIX } from "@/server/permissions";

describe("trust matrix", () => {
  it("admins can do everything", () => {
    for (const p of TRUST_MATRIX.admin) expect(can({ role: "admin" }, p)).toBe(true);
    expect(TRUST_MATRIX.admin.size).toBe(5);
  });

  it("privileged staff manage bookings but not staff or the audit log", () => {
    expect(can({ role: "privileged" }, "bookings.manage")).toBe(true);
    expect(can({ role: "privileged" }, "customers.contact")).toBe(true);
    expect(can({ role: "privileged" }, "staff.manage")).toBe(false);
    expect(can({ role: "privileged" }, "audit.view")).toBe(false);
  });

  it("viewers can only view the dashboard, with contact details masked", () => {
    expect([...TRUST_MATRIX.viewer]).toEqual(["dashboard.view"]);
    expect(can({ role: "viewer" }, "customers.contact")).toBe(false);
    expect(can({ role: "viewer" }, "bookings.manage")).toBe(false);
  });

  it("masks emails", () => {
    expect(maskEmail("jane.doe12@example.com")).toBe("j•••@example.com");
  });
});
