"use client";

import { addSettlementLineItem } from "./actions";
import type {
  LoadOption,
} from "./types";

type LineItemFormProps = {
  settlementId: string;
  loads: LoadOption[];
  resetKey?: string;
};

export function LineItemForm({
  settlementId,
  loads,
  resetKey,
}: LineItemFormProps) {
  return (
    <form
      key={
        resetKey ??
        `line-item-${settlementId}`
      }
      action={addSettlementLineItem}
      autoComplete="off"
      className="mt-5 grid gap-4 lg:grid-cols-2"
    >
      <input
        type="hidden"
        name="settlement_id"
        value={settlementId}
      />

      <label>
        <span className="text-sm font-semibold text-slate-300">
          Type
        </span>

        <select
          name="kind"
          defaultValue="earning"
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
        >
          <option value="earning">
            Earning
          </option>
          <option value="deduction">
            Deduction
          </option>
          <option value="reimbursement">
            Reimbursement
          </option>
        </select>
      </label>

      <label>
        <span className="text-sm font-semibold text-slate-300">
          Category
        </span>

        <input
          name="category"
          required
          placeholder="Example: linehaul, fuel, insurance"
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
        />
      </label>

      <label className="lg:col-span-2">
        <span className="text-sm font-semibold text-slate-300">
          Description
        </span>

        <input
          name="description"
          required
          placeholder="Description exactly as shown on the statement"
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
        />
      </label>

      <label>
        <span className="text-sm font-semibold text-slate-300">
          Amount
        </span>

        <input
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          required
          placeholder="0.00"
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
        />
      </label>

      <label>
        <span className="text-sm font-semibold text-slate-300">
          Related load
        </span>

        <select
          name="load_id"
          defaultValue=""
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
        >
          <option value="">
            No specific load
          </option>

          {loads.map((load) => (
            <option
              key={load.id}
              value={load.id}
            >
              {load.load_number}
              {" · "}
              {load.origin_city},{" "}
              {load.origin_state}
              {" → "}
              {load.destination_city},{" "}
              {load.destination_state}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="text-sm font-semibold text-slate-300">
          Deduction authorization
        </span>

        <input
          name="authorization_reference"
          placeholder="Optional agreement or authorization reference"
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
        />
      </label>

      <label>
        <span className="text-sm font-semibold text-slate-300">
          Balance after deduction
        </span>

        <input
          name="balance_after"
          type="number"
          min="0"
          step="0.01"
          placeholder="Optional"
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
        />
      </label>

      <p className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs leading-5 text-slate-500">
        Authorization and running-balance
        fields are stored only for deduction
        items. Earnings and reimbursements
        ignore those fields.
      </p>

      <button
        type="submit"
        className="lg:col-span-2 rounded-xl bg-sky-500 px-5 py-3.5 font-black text-white transition hover:bg-sky-400"
      >
        Add line item
      </button>
    </form>
  );
}
