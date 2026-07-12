import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { DeleteSettlementForm } from "./delete-settlement-form";
import { SettlementForm } from "./settlement-form";

export const metadata: Metadata = {
  title: "Settlements",
  description:
    "Add and manage Axleledger settlement records.",
};

type SettlementRecord = {
  id: string;
  settlement_date: string;
  carrier_or_company: string | null;
  gross_pay: number;
  deductions: number;
  reimbursements: number;
  net_deposit: number;
  notes: string | null;
  created_at: string;
};

type SettlementsPageProps = {
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

export default async function SettlementsPage({
  searchParams,
}: SettlementsPageProps) {
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
    .from("settlements")
    .select(
      `
        id,
        settlement_date,
        carrier_or_company,
        gross_pay,
        deductions,
        reimbursements,
        net_deposit,
        notes,
        created_at
      `,
    )
    .eq("user_id", userId)
    .order("settlement_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  const settlements =
    (data ?? []) as SettlementRecord[];

  const editingSettlement = edit
    ? settlements.find(
        (settlement) =>
          settlement.id === edit,
      )
    : undefined;

  const totalGrossPay =
    settlements.reduce(
      (total, settlement) =>
        total +
        Number(settlement.gross_pay),
      0,
    );

  const totalDeductions =
    settlements.reduce(
      (total, settlement) =>
        total +
        Number(settlement.deductions),
      0,
    );

  const totalNetDeposits =
    settlements.reduce(
      (total, settlement) =>
        total +
        Number(settlement.net_deposit),
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
              Settlement management
            </p>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/fixed-costs"
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-bold text-slate-200 transition hover:border-sky-400 hover:text-white sm:px-4"
            >
              Fixed costs
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
            Actual weekly pay
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Settlements
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Record settlement statements,
            deductions, reimbursements, and
            actual bank deposits.
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
            settlements.
          </div>
        ) : null}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Settlements
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {formatNumber(
                settlements.length,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Gross pay
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {formatCurrency(
                totalGrossPay,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Deductions
            </p>

            <p className="mt-3 text-2xl font-black text-amber-400">
              {formatCurrency(
                totalDeductions,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Net deposits
            </p>

            <p className="mt-3 text-2xl font-black text-emerald-400">
              {formatCurrency(
                totalNetDeposits,
              )}
            </p>
          </article>
        </section>

        <section className="mt-8 grid items-start gap-6 xl:grid-cols-[0.9fr_1.4fr]">
          <SettlementForm
            editingSettlement={
              editingSettlement
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
                Settlement history
              </h2>
            </div>

            {settlements.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-xl font-black text-slate-400">
                  0
                </div>

                <p className="mt-4 font-bold text-white">
                  No settlements recorded
                </p>

                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Add your first settlement
                  statement using the form.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {settlements.map(
                  (settlement) => (
                    <section
                      key={settlement.id}
                      className="p-5 sm:p-6"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-black text-white">
                            {settlement.carrier_or_company ||
                              "Settlement"}
                          </h3>

                          <p className="mt-2 text-sm font-semibold text-slate-300">
                            {formatDate(
                              settlement.settlement_date,
                            )}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-400">
                            <span>
                              Gross{" "}
                              <strong className="text-white">
                                {formatCurrency(
                                  settlement.gross_pay,
                                )}
                              </strong>
                            </span>

                            <span>
                              Deductions{" "}
                              <strong className="text-amber-300">
                                {formatCurrency(
                                  settlement.deductions,
                                )}
                              </strong>
                            </span>

                            <span>
                              Reimbursements{" "}
                              <strong className="text-sky-300">
                                {formatCurrency(
                                  settlement.reimbursements,
                                )}
                              </strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                          <div className="text-right">
                            <p className="text-xs text-slate-500">
                              Net deposit
                            </p>

                            <p className="mt-1 text-lg font-black text-emerald-400">
                              {formatCurrency(
                                settlement.net_deposit,
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Link
                              href={`/settlements?edit=${settlement.id}#settlement-form`}
                              className="rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-bold text-sky-300 transition hover:border-sky-400/50 hover:bg-sky-400/20"
                            >
                              Edit
                            </Link>

                            <DeleteSettlementForm
                              settlementId={
                                settlement.id
                              }
                              description={`settlement dated ${formatDate(
                                settlement.settlement_date,
                              )}`}
                            />
                          </div>
                        </div>
                      </div>

                      {settlement.notes ? (
                        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Notes
                          </p>

                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                            {settlement.notes}
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
