"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { focusRing } from "@/components/ui/icon-button";
import { loginAction, type LoginState } from "./auth-actions";

/** View: staff sign-in. */
export function LoginScreen() {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(loginAction, { error: null, username: "" });
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="text-center font-display text-4xl tracking-[0.2em] text-white">
          Marquee<span className="text-marquee-400">.</span>
        </p>
        <p className="mt-1 text-center text-sm uppercase tracking-widest text-neutral-500">Staff</p>

        <form action={formAction} className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h1 className="text-lg font-semibold text-white">Sign in</h1>

          {state.error && (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {state.error}
            </p>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-200">Username</span>
            <input
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              defaultValue={state.username}
              className="rounded-lg border border-white/15 bg-neutral-950 px-3 py-2.5 text-white focus:border-marquee-400 focus:outline-none"
            />
          </label>
          <div className="flex flex-col gap-1.5 text-sm">
            <label htmlFor="staff-password" className="font-medium text-neutral-200">
              Password
            </label>
            <div className="relative">
              <input
                id="staff-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-white/15 bg-neutral-950 py-2.5 pl-3 pr-11 text-white focus:border-marquee-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                aria-controls="staff-password"
                className={`absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-neutral-400 hover:text-white ${focusRing}`}
              >
                <Icon name={showPassword ? "eye-off" : "eye"} className="h-5 w-5" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className={`mt-2 rounded-lg bg-marquee-500 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-marquee-400 disabled:opacity-60 ${focusRing}`}
          >
            {isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
