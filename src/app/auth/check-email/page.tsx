import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Check your email",
};

export default function CheckEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-amber-400/20 bg-slate-900/90 p-8 text-center shadow-2xl shadow-black/30">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 text-2xl font-black text-amber-300">
          !
        </div>

        <p className="mt-6 text-sm font-semibold text-amber-300">
          Confirmation required
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
          Check your email
        </h1>

        <p className="mt-4 text-sm leading-6 text-slate-400">
          Open the confirmation message from
          Axleledger and verify your email address
          before signing in.
        </p>

        <a
          href="/login"
          className="mt-7 inline-flex rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-bold text-white transition hover:border-sky-400"
        >
          Return to sign in
        </a>
      </section>
    </main>
  );
}
