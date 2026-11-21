"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { logIn, logOut } from "@/server/staff-auth";

export type LoginState = { error: string | null; username: string };

const Credentials = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

/** Login form action (used with useActionState). */
export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = Credentials.safeParse({ username: form.get("username"), password: form.get("password") });
  const username = String(form.get("username") ?? "");
  if (!parsed.success) return { error: "Enter your username and password.", username };

  const result = await logIn(parsed.data.username, parsed.data.password);
  if (!result.ok) return { error: result.error, username };
  redirect("/staff/dashboard");
}

export async function logoutAction(): Promise<void> {
  await logOut();
  redirect("/staff");
}
