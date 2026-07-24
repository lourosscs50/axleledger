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
          Add a fixed cost first, or unlink a cost
          already used on this settlement.
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
                      {fixedCost.frequency}
                      {" · Effective "}
                      {formatDate(
                        fixedCost.effective_date,
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-500">
                      Fixed amount
                    </p>
                    <p className="mt-1 font-black text-violet-300">
                      {formatCurrency(
                        fixedCost.amount,
                      )}
                    </p>
                  </div>
                </div>

                {fixedCost.notes ? (
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                    {fixedCost.notes}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="rounded-xl border border-violet-400/20 bg-violet-400/5 px-4 py-3 text-xs leading-5 text-violet-100/80">
        Linking copies each fixed cost&apos;s saved
        amount exactly. Axleledger does not prorate
        it or create a separate expected amount.
        Change the value only by editing the fixed-cost
        record.
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
