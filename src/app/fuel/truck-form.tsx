"use client";

import {
  useEffect,
  useRef,
} from "react";

import { createTruck } from "./actions";

type TruckFormProps = {
  resetKey?: string;
};

export function TruckForm({
  resetKey,
}: TruckFormProps) {
  const formRef =
    useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.reset();
  }, [resetKey]);

  return (
    <article
      id="truck-entry"
      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6"
    >
      <p className="text-sm font-semibold text-sky-400">
        Equipment setup
      </p>

      <h2 className="mt-1 text-2xl font-black text-white">
        Add a truck
      </h2>

      <form
        ref={formRef}
        action={createTruck}
        autoComplete="off"
        className="mt-6 space-y-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-sm font-semibold text-slate-300">
              Unit number
            </span>

            <input
              name="unit_number"
              required
              placeholder="Example: 2407"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              Year
            </span>

            <input
              name="year"
              type="number"
              min="1980"
              max="2100"
              step="1"
              placeholder="2026"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-sm font-semibold text-slate-300">
              Make
            </span>

            <input
              name="make"
              required
              placeholder="Peterbilt"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              Model
            </span>

            <input
              name="model"
              required
              placeholder="579"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            VIN
          </span>

          <input
            name="vin"
            minLength={17}
            maxLength={17}
            placeholder="Optional 17-character VIN"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 uppercase text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Tank capacity
          </span>

          <input
            name="tank_capacity_gallons"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Example: 240"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
          />
        </label>

        <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
          <input
            name="is_active"
            type="checkbox"
            defaultChecked
            className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-500"
          />

          <span>
            <span className="block text-sm font-semibold text-slate-300">
              Active truck
            </span>

            <span className="mt-1 block text-xs leading-5 text-slate-500">
              Active trucks appear first in
              diesel and DEF entry forms.
            </span>
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Notes
          </span>

          <textarea
            name="notes"
            rows={3}
            placeholder="Optional equipment details"
            className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-xl bg-sky-500 px-5 py-3.5 font-black text-white transition hover:bg-sky-400"
        >
          Save truck
        </button>
      </form>
    </article>
  );
}
