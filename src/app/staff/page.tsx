import { redirect } from "next/navigation";
import { LoginScreen } from "@/features/staff/login-screen";
import { getCurrentStaff } from "@/server/staff-auth";

export const dynamic = "force-dynamic";

/** /staff: the sign-in page, or straight to the dashboard when already signed in. */
export default async function StaffLoginPage() {
  if (await getCurrentStaff()) redirect("/staff/dashboard");
  return <LoginScreen />;
}
