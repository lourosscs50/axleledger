import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { DeleteExpenseForm } from "./delete-expense-form";
import { ExpenseForm } from "./expense-form";

export const metadata: Metadata = {
  title: "Expenses",
  description:
    "Add and manage Axleledger operating expenses.",
};

type ExpenseCategory =
  | "fuel"
  | "def"
  | "maintenance"
  | "tolls"
  | "parking"
  | "scales"
  | "food"
  | "supplies"
  | "other";

type ExpenseRecord = {
  id: string;
  load_id: string | null;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  vendor: string | null;
  notes: string | null;
  created_at: string;
};

type LoadOption = {
  id: string;
  load_number: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
};

type ExpensesPageProps = {
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

const defaultDateFormatter =
  new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Chicago",
  });

const categoryDetails: Record<
  ExpenseCategory,
  {
    label: string;
    className: string;
  }
> = {
  fuel: {
    label: "Fuel",
    className:
      "border-amber-400/20 bg-amber-400/10 text-amber-300",
  },
  def: {
    label: "DEF",
    className:
      "border-sky-400/20 bg-sky-400/10 text-sky-300",
  },
  maintenance: {
    label: "Maintenance",
    className:
      "border-violet-400/20 bg-violet-400/10 text-violet-300",
  },
  tolls: {
    label: "Tolls",
    className:
      "border-sky-400/20 bg-sky-400/10 text-sky-300",
  },
  parking: {
    label: "Parking",
    className:
      "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
  },
  scales: {
    label: "Scales",
    className:
      "border-indigo-400/20 bg-indigo-400/10 text-indigo-300",
  },
  food: {
    label: "Food",
    className:
      "border-orange-400/20 bg-orange-400/10 text-orange-300",
  },
  supplies: {
    label: "Supplies",
    className:
      "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  },
  other: {
    label: "Other",
    className:
      "border-slate-700 bg-slate-800 text-slate-300",
  },
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
  const parts =
    defaultDateFormatter.formatToParts(
      new Date(),
    );

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ]),
  ) as Record<string, string>;

  if (
    values.year &&
    values.month &&
    values.day
  ) {
    return `${values.year}-${values.month}-${values.day}`;
  }

  return new Date()
    .toISOString()
    .slice(0, 10);
}

export default async function ExpensesPage({
  searchParams,
}: ExpensesPageProps) {
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

  const [
    {
      data: expensesData,
      error: expensesQueryError,
    },
    {
      data: loadsData,
      error: loadsQueryError,
    },
    {
      data: fuelLinksData,
      error: fuelLinksError,
    },
    {
      data: defLinksData,
      error: defLinksError,
    },
    {
      data: maintenanceLinksData,
      error: maintenanceLinksError,
    },
    {
      data: settlementLinksData,
      error: settlementLinksError,
    },
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select(
        `
          id,
          load_id,
          category,
          amount,
          expense_date,
          vendor,
          notes,
          created_at
        `,
      )
      .eq("user_id", userId)
      .order("expense_date", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      }),
    supabase
      .from("loads")
      .select(
        `
          id,
          load_number,
          origin_city,
          origin_state,
          destination_city,
          destination_state
        `,
      )
      .eq("user_id", userId)
      .order("pickup_date", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      }),
    supabase
      .from("fuel_transactions")
      .select("expense_id")
      .eq("user_id", userId),
    supabase
      .from("def_transactions")
      .select("expense_id")
      .eq("user_id", userId),
    supabase
      .from("maintenance_records")
      .select("expense_id")
      .eq("user_id", userId)
      .not("expense_id", "is", null),
    supabase
      .from("settlement_line_items")
      .select("expense_id, settlement_id")
      .eq("user_id", userId)
      .not("expense_id", "is", null),
  ]);

  const expenses =
    (expensesData ?? []) as ExpenseRecord[];

  const loads =
    (loadsData ?? []) as LoadOption[];

  const fuelExpenseIds =
    new Set<string>([
      ...(fuelLinksData ?? []).map(
        (
          record: {
            expense_id: string;
          },
        ) => record.expense_id,
      ),
      ...(defLinksData ?? []).map(
        (
          record: {
            expense_id: string;
          },
        ) => record.expense_id,
      ),
    ]);

  const maintenanceExpenseIds =
    new Set<string>(
      (maintenanceLinksData ?? [])
        .map(
          (
            record: {
              expense_id:
                | string
                | null;
            },
          ) => record.expense_id,
        )
        .filter(
          (
            expenseId,
          ): expenseId is string =>
            Boolean(expenseId),
        ),
    );

  const structuredExpenseIds =
    new Set<string>([
      ...fuelExpenseIds,
      ...maintenanceExpenseIds,
    ]);

  const settlementByExpenseId =
    new Map<string, string>(
      (settlementLinksData ?? [])
        .filter(
          (
            record: {
              expense_id:
                | string
                | null;
              settlement_id: string;
            },
          ): record is {
            expense_id: string;
            settlement_id: string;
          } =>
            Boolean(record.expense_id),
        )
        .map((record) => [
          record.expense_id,
          record.settlement_id,
        ]),
    );

  const protectedExpenseIds =
    new Set<string>([
      ...structuredExpenseIds,
      ...settlementByExpenseId.keys(),
    ]);

  const loadsById = new Map(
    loads.map((load) => [
      load.id,
      load,
    ]),
  );

  const editingExpense = edit
    ? expenses.find(
        (expense) =>
          expense.id === edit &&
          !protectedExpenseIds.has(
            expense.id,
          ),
      )
    : undefined;

  const totalExpenses = expenses.reduce(
    (total, expense) =>
      total + Number(expense.amount),
    0,
  );

  const fuelExpenses = expenses
    .filter(
      (expense) =>
        expense.category === "fuel",
    )
    .reduce(
      (total, expense) =>
        total + Number(expense.amount),
      0,
    );

  const linkedExpenseCount =
    expenses.filter(
      (expense) => expense.load_id,
    ).length;

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
              Expense management
            </p>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/loads"
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-bold text-slate-200 transition hover:border-sky-400 hover:text-white sm:px-4"
            >
              Loads
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
            Operating costs
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Expenses
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Record every business expense so
            Axleledger can calculate your true
            operating costs and net profit.
            Link direct expenses to a load when
            possible.
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

        {expensesQueryError ? (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-200"
          >
            Axleledger could not retrieve your
            expenses.
          </div>
        ) : null}

        {loadsQueryError ? (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-200"
          >
            Your loads could not be retrieved.
            Expenses can still be recorded
            without linking them to a load.
          </div>
        ) : null}

        {fuelLinksError ||
        defLinksError ||
        maintenanceLinksError ||
        settlementLinksError ? (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-200"
          >
            Structured or settlement expense
            links could not be fully verified.
            Linked records must be managed from
            their operations or settlement pages.
          </div>
        ) : null}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Recorded expenses
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {formatNumber(
                expenses.length,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Total expenses
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {formatCurrency(
                totalExpenses,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Fuel expenses
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {formatCurrency(
                fuelExpenses,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Linked to loads
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {formatNumber(
                linkedExpenseCount,
              )}
            </p>
          </article>
        </section>

        <section className="mt-8 grid items-start gap-6 xl:grid-cols-[0.9fr_1.4fr]">
          <ExpenseForm
            editingExpense={
              editingExpense
            }
            loads={loads}
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
                Expense history
              </h2>
            </div>

            {expenses.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-xl font-black text-slate-400">
                  0
                </div>

                <p className="mt-4 font-bold text-white">
                  No expenses recorded
                </p>

                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Add your first business
                  expense using the form. It
                  will appear here immediately.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {expenses.map(
                  (expense) => {
                    const category =
                      categoryDetails[
                        expense.category
                      ];

                    const linkedLoad =
                      expense.load_id
                        ? loadsById.get(
                            expense.load_id,
                          )
                        : undefined;

                    const description =
                      `${category.label} expense of ${formatCurrency(
                        expense.amount,
                      )}`;

                    return (
                      <section
                        key={expense.id}
                        className="p-5 sm:p-6"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="text-lg font-black text-white">
                                {expense.vendor ||
                                  category.label}
                              </h3>

                              <span
                                className={`rounded-full border px-2.5 py-1 text-xs font-bold ${category.className}`}
                              >
                                {
                                  category.label
                                }
                              </span>
                            </div>

                            <p className="mt-2 text-sm font-semibold text-slate-300">
                              {formatDate(
                                expense.expense_date,
                              )}
                            </p>

                            {linkedLoad ? (
                              <p className="mt-3 text-sm font-medium leading-6 text-slate-300">
                                Related load:{" "}
                                <span className="font-bold text-white">
                                  {
                                    linkedLoad.load_number
                                  }
                                </span>
                                {" · "}
                                {
                                  linkedLoad.origin_city
                                }
                                ,{" "}
                                {
                                  linkedLoad.origin_state
                                }
                                {" → "}
                                {
                                  linkedLoad.destination_city
                                }
                                ,{" "}
                                {
                                  linkedLoad.destination_state
                                }
                              </p>
                            ) : (
                              <p className="mt-2 text-xs text-slate-500">
                                No specific load
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                            <p className="text-lg font-black text-white">
                              {formatCurrency(
                                expense.amount,
                              )}
                            </p>

                            {fuelExpenseIds.has(
                              expense.id,
                            ) ? (
                              <Link
                                href="/fuel"
                                className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-300 transition hover:border-amber-400/50 hover:bg-amber-400/20"
                              >
                                Manage in Fuel
                              </Link>
                            ) : maintenanceExpenseIds.has(
                                expense.id,
                              ) ? (
                              <Link
                                href="/maintenance"
                                className="rounded-lg border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-xs font-bold text-violet-300 transition hover:border-violet-400/50 hover:bg-violet-400/20"
                              >
                                Manage in Maintenance
                              </Link>
                            ) : settlementByExpenseId.has(
                                expense.id,
                              ) ? (
                              <Link
                                href={`/settlements?manage=${settlementByExpenseId.get(
                                  expense.id,
                                )}#settlement-workspace`}
                                className="rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-bold text-sky-300 transition hover:border-sky-400/50 hover:bg-sky-400/20"
                              >
                                Linked to settlement
                              </Link>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/expenses?edit=${expense.id}#expense-form`}
                                  className="rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-bold text-sky-300 transition hover:border-sky-400/50 hover:bg-sky-400/20"
                                >
                                  Edit
                                </Link>

                                <DeleteExpenseForm
                                  expenseId={
                                    expense.id
                                  }
                                  description={
                                    description
                                  }
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {expense.notes ? (
                          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Notes
                            </p>

                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                              {expense.notes}
                            </p>
                          </div>
                        ) : null}
                      </section>
                    );
                  },
                )}
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
