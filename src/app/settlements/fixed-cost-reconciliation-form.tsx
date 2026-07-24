"use client";

import {
  linkSettlementFixedCosts,
} from "./actions";
import type {
  FixedCostOption,
} from "./types";

type FixedCostReconciliationFormProps = {
  settlementId: string;
  fixedCosts: FixedCostOption[];
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

export function FixedCostReconciliationForm({
  settlementId,
  fixedCosts,
}: FixedCostReconciliationFormProps) {
  if (fixedCosts.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-6 text-center">
        <p className="font-bold text-white">
          No available fixed costs
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Add a recurring fixed cost first, or
          unlink a cost already used on this
          settlement.
        </p>
      </div>
    );
  }

  return (
    <form
      action={linkSettlementFixedCosts}
      className="mt-5 space-y-4"
    >
      <input
        type="hidden"
        name="settlement_id"
        value={settlementId}
      />

      <div className="space-y-3">
        {fixedCosts.map((fixedCost) => (
          <section
            key={fixedCost.id}
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-violet-400/40"
          >
            <div className="flex items-start gap-3">
              <label className="mt-1 flex shrink-0 items-center">
                <input
                  type="checkbox"
                  name="fixed_cost_id"
                  value={fixedCost.id}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-violet-500"
                />

                <span className="sr-only">
                  Select {fixedCost.name}
                </span>
              </label>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-white">
                        {fixedCost.name}
                      </p>

                      <span
                        className={
                          fixedCost.is_active
                            ? "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-bold text-emerald-300"
                            : "rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-400"
                        }
                      >
                        {fixedCost.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </div>

                    <p className="mt-1 text-xs capitalize text-slate-500">
                      {fixedCost.category.replaceAll(
                        "_",
                        " ",
                      )}
                      {" · "}
                      {formatCurrency(
                        fixedCost.amount,
                      )}
                      {" "}
                      {fixedCost.frequency}
                      {" · Effective "}
                      {formatDate(
                        fixedCost.effective_date,
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-500">
                      Expected this statement
                    </p>
                    <p className="mt-1 font-black text-violet-300">
                      {formatCurrency(
                        fixedCost.expected_amount,
                      )}
                    </p>
                  </div>
                </div>

                {fixedCost.notes ? (
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                    {fixedCost.notes}
                  </p>
                ) : null}

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <label>
                    <span className="text-xs font-semibold text-slate-400">
                      Statement deduction
                    </span>

                    <input
                      name={`statement_amount_${fixedCost.id}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={Number(
                        fixedCost.expected_amount,
                      ).toFixed(2)}
                      className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-violet-400"
                    />
                  </label>

                  <label>
                    <span className="text-xs font-semibold text-slate-400">
                      Variance reason
                    </span>

                    <input
                      name={`variance_reason_${fixedCost.id}`}
                      placeholder="Required only when amounts differ"
                      className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none placeholder:text-slate-600 focus:border-violet-400"
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="rounded-xl border border-violet-400/20 bg-violet-400/5 px-4 py-3 text-xs leading-5 text-violet-100/80">
        Axleledger calculates the expected amount
        from the fixed-cost schedule and settlement
        period. Only a statement variance is added
        beyond the recurring dashboard cost.
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-violet-500 px-5 py-3.5 font-black text-white transition hover:bg-violet-400"
      >
        Link selected fixed costs
      </button>
    </form>
  );
}
