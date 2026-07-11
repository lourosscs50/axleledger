import type { Metadata } from "next";

import { login, signup } from "./actions";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in or create your Axleledger account.",
};

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <p className="text-2xl font-black tracking-tight text-white">
            Axle
            <span className="text-sky-400">
              ledger
            </span>
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Know what every mile earns.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <p className="text-sm font-semibold text-sky-400">
            Secure access
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
            Welcome to Axleledger
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Sign in to manage your loads, expenses,
            settlements, miles, and actual operating
            profit.
          </p>

          {error ? (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
            >
              {error}
            </div>
          ) : null}

          <form className="mt-7 space-y-5">
            <label className="block">
              <span className="text-sm font-semibold text-slate-300">
                Email address
              </span>

              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="driver@example.com"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-300">
                Password
              </span>

              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400"
              />
            </label>

            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <button
                type="submit"
                formAction={login}
                className="rounded-xl bg-sky-500 px-4 py-3 font-bold text-white transition hover:bg-sky-400"
              >
                Sign in
              </button>

              <button
                type="submit"
                formAction={signup}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-bold text-slate-100 transition hover:border-sky-400"
              >
                Create account
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
