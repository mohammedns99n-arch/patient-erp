"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export type LoginLabels = {
  appName: string;
  subtitle: string;
  email: string;
  password: string;
  signIn: string;
  signingIn: string;
};

export default function LoginForm({ labels }: { labels: LoginLabels }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold">{labels.appName}</h1>
          <p className="text-sm text-black/50 dark:text-white/50 mt-1">{labels.subtitle}</p>
        </div>

        <form
          action={formAction}
          className="space-y-4 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-6 shadow-sm"
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">{labels.email}</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              dir="ltr"
              className="w-full rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">{labels.password}</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              dir="ltr"
              className="w-full rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {state.error && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-md px-3 py-2">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? labels.signingIn : labels.signIn}
          </button>
        </form>
      </div>
    </main>
  );
}
