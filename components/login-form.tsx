"use client";

/**
 * The password gate in front of /admin. One field, one shared password — see
 * `lib/auth.ts` for why this site does not carry a full auth provider.
 */

import { useActionState } from "react";

import { signInAction } from "@/app/actions";

export function LoginForm() {
  const [error, formAction, pending] = useActionState<string | null, FormData>(
    signInAction,
    null,
  );

  return (
    <form action={formAction} className="mx-auto flex w-full max-w-xs flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-xs tracking-widest text-ink/50 uppercase">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          autoFocus
          className="rounded-md border border-ink/15 bg-ink/5 px-3 py-2 text-ink outline-none focus:border-ink/40"
        />
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-ink px-3 py-2 font-medium text-paper transition hover:bg-ink/85 disabled:opacity-50"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
