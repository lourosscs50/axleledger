"use client";

import { addSettlementAdjustment } from "./actions";

type AdjustmentFormProps = {
  settlementId: string;
};

export function AdjustmentForm({
  settlementId,
}: AdjustmentFormProps) {
  return (
    <form
      action={addSettlementAdjustment}
      autoComplete="off"
      className="mt-5 grid gap-4 sm:grid-cols-[160px_1fr_auto] sm:items-end"
    >
      <input
        type="hidden"
        name="settlement_id"
        value={settlementId}
      />

      <label>
        <span className="text-sm font-semibold text-slate-300">
          Signed amount
        </span>

        <input
          name="amount"
          type="number"
          step="0.01"
          required
          placeholder="-25.00"
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
        />
      </label>

      <label>
        <span className="text-sm font-semibold text-slate-300">
          Correction reason
        </span>

        <textarea
          name="reason"
          required
          rows={3}
          placeholder="Explain why this approved value changed"
          className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
        />
      </label>

      <button
        type="submit"
        className="rounded-xl bg-amber-500 px-5 py-3 font-black text-slate-950 transition hover:bg-amber-400"
      >
        Add adjustment
      </button>
    </form>
  );
}
