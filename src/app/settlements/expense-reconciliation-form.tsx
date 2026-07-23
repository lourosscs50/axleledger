"use client";

import {
  linkSettlementExpenses,
} from "./actions";
import type {
  ExpenseOption,
} from "./types";

type ExpenseReconciliationFormProps = {
  settlementId: string;
  expenses: ExpenseOption[];
};

const currencyFormatter =
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

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

function formatDate(value: string) {
  return dateFormatter.format(
    new Date(`${value}T00:00:00Z`),
  );
}

export function ExpenseReconciliationForm({
  settlementId,
  expenses,
}: ExpenseReconciliationFormProps) {
  if (expenses.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-6 text-center">
        <p className="font-bold text-white">
          No unlinked operating expenses
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Record expenses first, or unlink an
          expense from another settlement before
          using it here.
        </p>
      </div>
    );
  }

  return (
    <form
      action={linkSettlementExpenses}
      className="mt-5 space-y-4"
    >
      <input
        type="hidden"
        name="settlement_id"
        value={settlementId}
      />

      <div className="space-y-3">
        {expenses.map((expense) => {
          const title =
            expense.vendor ||
            expense.category.replaceAll(
              "_",
              " ",
            );

          return (
            <section
              key={expense.id}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-sky-400/40"
            >
              <div className="flex items-start gap-3">
                <label className="mt-1 flex shrink-0 items-center">
                  <input
                    type="checkbox"
                    name="expense_id"
                    value={expense.id}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-sky-500"
                  />

                  <span className="sr-only">
                    Select {title}
                  </span>
                </label>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-black capitalize text-white">
                        {title}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(
                          expense.expense_date,
                        )}
                        {" · "}
                        {expense.category.replaceAll(
                          "_",
                          " ",
                        )}
                      </p>
                    </div>

                    <p className="font-black text-slate-200">
                      {formatCurrency(
                        expense.amount,
                      )}
                    </p>
                  </div>

                  {expense.load_label ? (
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {expense.load_label}
                    </p>
                  ) : null}

                  {expense.notes ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                      {expense.notes}
                    </p>
                  ) : null}

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <label>
                      <span className="text-xs font-semibold text-slate-400">
                        Statement deduction
                      </span>

                      <input
                        name={`statement_amount_${expense.id}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        defaultValue={Number(
                          expense.amount,
                        ).toFixed(2)}
                        className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-sky-400"
                      />
                    </label>

                    <label>
                      <span className="text-xs font-semibold text-slate-400">
                        Variance reason
                      </span>

                      <input
                        name={`variance_reason_${expense.id}`}
                        placeholder="Required only when amounts differ"
                        className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3 text-xs leading-5 text-sky-100/80">
        The original expense remains the operating
        ledger record. This creates only a
        settlement reconciliation line, so the
        cost is not counted twice.
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-sky-500 px-5 py-3.5 font-black text-white transition hover:bg-sky-400"
      >
        Link selected expenses
      </button>
    </form>
  );
}
