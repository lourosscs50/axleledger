"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
} from "react";

import {
  createFuelTransaction,
  updateFuelTransaction,
} from "./actions";
import type {
  LoadOption,
  TruckOption,
} from "./types";

type EditableFuelTransaction = {
  id: string;
  truck_id: string | null;
  load_id: string | null;
  transaction_date: string;
  transaction_time: string | null;
  odometer: number | null;
  gallons: number | null;
  pump_price_per_gallon: number | null;
  discount_per_gallon: number | null;
  total_amount: number;
  network: string | null;
  location_name: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
};

type FuelFormProps = {
  trucks: TruckOption[];
  loads: LoadOption[];
  defaultDate: string;
  resetKey?: string;
  editingTransaction?: EditableFuelTransaction;
  editRequested?: boolean;
};

export function FuelForm({
  trucks,
  loads,
  defaultDate,
  resetKey,
  editingTransaction,
  editRequested = false,
}: FuelFormProps) {
  const formRef =
    useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (editingTransaction) {
      return;
    }

    const form = formRef.current;

    if (!form) {
      return;
    }

    form.reset();

    const dateField =
      form.elements.namedItem(
        "transaction_date",
      );

    if (
      dateField instanceof
      HTMLInputElement
    ) {
      dateField.value = defaultDate;
    }
  }, [
    defaultDate,
    editingTransaction,
    resetKey,
  ]);

  return (
    <article
      id="fuel-entry"
      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6"
    >
      <p className="text-sm font-semibold text-amber-400">
        {editingTransaction
          ? "Edit diesel"
          : "Diesel entry"}
      </p>

      <h2 className="mt-1 text-2xl font-black text-white">
        {editingTransaction
          ? "Update diesel transaction"
          : "Add diesel"}
      </h2>

      {editRequested &&
      !editingTransaction ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-200"
        >
          That diesel transaction could not be
          edited. Legacy imports and missing
          records remain read-only.
        </div>
      ) : null}

      {trucks.length === 0 ? (
        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-200">
          Add a truck before recording a
          structured diesel transaction.
        </div>
      ) : null}

      <form
        ref={formRef}
        key={
          editingTransaction?.id ??
          resetKey ??
          "new-diesel"
        }
        action={
          editingTransaction
            ? updateFuelTransaction
            : createFuelTransaction
        }
        autoComplete="off"
        className="mt-6 space-y-5"
      >
        {editingTransaction ? (
          <input
            type="hidden"
            name="transaction_id"
            value={editingTransaction.id}
          />
        ) : null}

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Truck
          </span>

          <select
            name="truck_id"
            required
            disabled={trucks.length === 0}
            defaultValue={
              editingTransaction?.truck_id ??
              trucks[0]?.id ??
              ""
            }
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {trucks.length === 0 ? (
              <option value="">
                No truck available
              </option>
            ) : null}

            {trucks.map((truck) => (
              <option
                key={truck.id}
                value={truck.id}
              >
                Unit {truck.unit_number}
                {" · "}
                {truck.year
                  ? `${truck.year} `
                  : ""}
                {truck.make} {truck.model}
                {truck.is_active
                  ? ""
                  : " · Inactive"}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Related load
          </span>

          <select
            name="load_id"
            defaultValue={
              editingTransaction?.load_id ??
              ""
            }
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

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-sm font-semibold text-slate-300">
              Date
            </span>

            <input
              name="transaction_date"
              type="date"
              required
              defaultValue={
                editingTransaction
                  ?.transaction_date ??
                defaultDate
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              Time
            </span>

            <input
              name="transaction_time"
              type="time"
              defaultValue={
                editingTransaction
                  ?.transaction_time ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Odometer
          </span>

          <input
            name="odometer"
            type="number"
            min="0"
            step="1"
            placeholder="Optional"
            defaultValue={
              editingTransaction?.odometer ??
              ""
            }
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-sm font-semibold text-slate-300">
              Gallons
            </span>

            <input
              name="gallons"
              type="number"
              min="0.001"
              step="0.001"
              required
              placeholder="0.000"
              defaultValue={
                editingTransaction?.gallons ??
                ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              Pump price
            </span>

            <input
              name="pump_price_per_gallon"
              type="number"
              min="0.0001"
              step="0.0001"
              required
              placeholder="0.0000"
              defaultValue={
                editingTransaction
                  ?.pump_price_per_gallon ??
                ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              Discount per gallon
            </span>

            <input
              name="discount_per_gallon"
              type="number"
              min="0"
              step="0.0001"
              required
              defaultValue={
                editingTransaction
                  ?.discount_per_gallon ?? 0
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              Actual total
            </span>

            <input
              name="total_amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="0.00"
              defaultValue={
                editingTransaction
                  ?.total_amount ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>
        </div>

        <p className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs leading-5 text-slate-500">
          Net price is calculated from pump
          price minus discount. Updating the
          receipt total also updates the existing
          linked expense instead of creating a
          second cost.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-sm font-semibold text-slate-300">
              Network
            </span>

            <input
              name="network"
              placeholder="Pilot/Flying J"
              defaultValue={
                editingTransaction?.network ??
                ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              Location
            </span>

            <input
              name="location_name"
              placeholder="Store or stop name"
              defaultValue={
                editingTransaction
                  ?.location_name ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_90px]">
          <label>
            <span className="text-sm font-semibold text-slate-300">
              City
            </span>

            <input
              name="city"
              defaultValue={
                editingTransaction?.city ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              State
            </span>

            <input
              name="state"
              minLength={2}
              maxLength={2}
              placeholder="TX"
              defaultValue={
                editingTransaction?.state ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 uppercase text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Notes
          </span>

          <textarea
            name="notes"
            rows={3}
            placeholder="Optional receipt details"
            defaultValue={
              editingTransaction?.notes ?? ""
            }
            className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={trucks.length === 0}
            className="flex-1 rounded-xl bg-amber-500 px-5 py-3.5 font-black text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {editingTransaction
              ? "Update diesel transaction"
              : "Save diesel transaction"}
          </button>

          {editingTransaction ? (
            <Link
              href="/fuel#fuel-entry"
              className="rounded-xl border border-slate-700 bg-slate-950 px-5 py-3.5 text-center font-bold text-slate-300 transition hover:border-slate-600 hover:text-white"
            >
              Cancel
            </Link>
          ) : null}
        </div>
      </form>
    </article>
  );
}
