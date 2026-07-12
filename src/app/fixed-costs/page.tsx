import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { DeleteFixedCostForm } from "./delete-fixed-cost-form";
import { FixedCostForm } from "./fixed-cost-form";

export const metadata: Metadata = {
  title: "Fixed Costs",
  description:
    "Add and manage Axleledger recurring fixed costs.",
};

type FixedCostCategory =
  | "truck_payment"
  | "insurance"
  | "permits"
  | "communications"
  | "subscriptions"
  | "other";

type FixedCostFrequency =
  | "weekly"
  | "monthly";

type FixedCostRecord = {
  id: string;
  name: string;
  category: FixedCostCategory;
  amount: number;
  frequency: FixedCostFrequency;
  effective_date: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

type FixedCostsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    edit?: string;
    saved?: string;
  }>;
};

const currencyFormatter =
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

const numberFormatter =
  new Intl.NumberFormat("en-US");

const dateFormatter =
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

const categoryLabels: Record<
  FixedCostCategory,
  string
> = {
  truck_payment: "Truck payment",
  insurance: "Insurance",
  permits: "Permits",
  communications: "Communications",
  subscriptions: "Subscriptions",
  other: "Other",
};

function formatCurrency(value: number) {
  return currencyFormatter.format(
    Number(value),
  );
}

function formatNumber(value: number) {
  return numberFormatter.format(
    Number(value),
  );
}

function formatDate(value: string) {
  return dateFormatter.format(
    new Date(`${value}T00:00:00Z`),
  );
}

function getDefaultDate() {
  const formatter =
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/Chicago",
    });

  const parts =
    formatter.formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ]),
  ) as Record<string, string>;

  return `${values.year}-${values.month}-${values.day}`;
}

export default async function FixedCostsPage({
  searchParams,
}: FixedCostsPageProps) {
  const {
    error,
    success,
    edit,
    saved,
  } = await searchParams;

  const supabase = await createClient();

  const { data: claimsData } =
    await supabase.auth.getClaims();

  const userId =
    typeof claimsData?.claims?.sub ===
    "string"
      ? claimsData.claims.sub
      : null;

  if (!userId) {
    redirect("/login");
  }

  const {
    data,
    error: queryError,
  } = await supabase
    .from("fixed_costs")
    .select(
      `
        id,
        name,
        category,
        amount,
        frequency,
        effective_date,
        is_active,
        notes,
        created_at
      `,
    )
    .eq("user_id", userId)
    .order("is_active", {
      ascending: false,
    })
    .order("effective_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  const fixedCosts =
    (data ?? []) as FixedCostRecord[];

  const editingFixedCost = edit
    ? fixedCosts.find(
        (fixedCost) =>
          fixedCost.id === edit,
      )
    : undefined;

  const activeFixedCosts =
    fixedCosts.filter(
      (fixedCost) =>
        fixedCost.is_active,
    );

  const weeklyEquivalent =
    activeFixedCosts.reduce(
      (total, fixedCost) =>
        total +
        (fixedCost.frequency ===
        "weekly"
          ? Number(fixedCost.amount)
          : Number(
              fixedCost.amount,
            ) / 4.345),
      0,
    );

  const monthlyEquivalent =
    activeFixedCosts.reduce(
      (total, fixedCost) =>
        total +
        (fixedCost.frequency ===
        "monthly"
          ? Number(fixedCost.amount)
          : Number(
              fixedCost.amount,
            ) * 4.345),
      0,
    );

  return (
    <main className="min-h-screen pb-16">
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <Link
              href="/"
              className="text-xl font-black tracking-tight text-white"
            >
              Axle
              <span className="text-sky-400">
                ledger
              </span>
            </Link>

            <p className="mt-0.5 text-xs text-slate-500">
              Recurring-cost management
            </p>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/settlements"
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-bold text-slate-200 transition hover:border-sky-400 hover:text-white sm:px-4"
            >
              Settlements
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-bold text-slate-200 transition hover:border-sky-400 hover:text-white sm:px-4"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <section>
          <p className="text-sm font-semibold text-sky-400">
            Recurring obligations
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Fixed costs
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Track truck payments, insurance,
            permits, subscriptions, and other
            repeating business costs.
          </p>
        </section>

        {error ? (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-200"
          >
            {error}
          </div>
        ) : null}

        {success ? (
          <div
            role="status"
            className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-200"
          >
            {success}
          </div>
        ) : null}

        {queryError ? (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-200"
          >
            Axleledger could not retrieve your
            fixed costs.
          </div>
        ) : null}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Fixed-cost records
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {formatNumber(
                fixedCosts.length,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Active costs
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {formatNumber(
                activeFixedCosts.length,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Weekly equivalent
            </p>

            <p className="mt-3 text-2xl font-black text-amber-400">
              {formatCurrency(
                weeklyEquivalent,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Monthly equivalent
            </p>

            <p className="mt-3 text-2xl font-black text-amber-400">
              {formatCurrency(
                monthlyEquivalent,
              )}
            </p>
          </article>
        </section>

        <section className="mt-8 grid items-start gap-6 xl:grid-cols-[0.9fr_1.4fr]">
          <FixedCostForm
            editingFixedCost={
              editingFixedCost
            }
            resetKey={saved}
            editRequested={Boolean(edit)}
            defaultDate={getDefaultDate()}
          />

          <article className="self-start overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
            <div className="border-b border-slate-800 px-5 py-5 sm:px-6">
              <p className="text-sm font-semibold text-sky-400">
                Your records
              </p>

              <h2 className="mt-1 text-2xl font-black text-white">
                Fixed-cost history
              </h2>
            </div>

            {fixedCosts.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-xl font-black text-slate-400">
                  0
                </div>

                <p className="mt-4 font-bold text-white">
                  No fixed costs recorded
                </p>

                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Add your recurring business
                  obligations using the form.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {fixedCosts.map(
                  (fixedCost) => (
                    <section
                      key={fixedCost.id}
                      className="p-5 sm:p-6"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-black text-white">
                              {fixedCost.name}
                            </h3>

                            <span
                              className={
                                fixedCost.is_active
                                  ? "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-300"
                                  : "rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-400"
                              }
                            >
                              {fixedCost.is_active
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </div>

                          <p className="mt-2 text-sm font-semibold text-slate-300">
                            {
                              categoryLabels[
                                fixedCost.category
                              ]
                            }
                          </p>

                          <p className="mt-2 text-sm text-slate-400">
                            Effective{" "}
                            {formatDate(
                              fixedCost.effective_date,
                            )}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                          <div className="text-right">
                            <p className="text-lg font-black text-white">
                              {formatCurrency(
                                fixedCost.amount,
                              )}
                            </p>

                            <p className="mt-1 text-xs capitalize text-slate-500">
                              {fixedCost.frequency}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Link
                              href={`/fixed-costs?edit=${fixedCost.id}#fixed-cost-form`}
                              className="rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-bold text-sky-300 transition hover:border-sky-400/50 hover:bg-sky-400/20"
                            >
                              Edit
                            </Link>

                            <DeleteFixedCostForm
                              fixedCostId={
                                fixedCost.id
                              }
                              description={
                                fixedCost.name
                              }
                            />
                          </div>
                        </div>
                      </div>

                      {fixedCost.notes ? (
                        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Notes
                          </p>

                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                            {fixedCost.notes}
                          </p>
                        </div>
                      ) : null}
                    </section>
                  ),
                )}
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
