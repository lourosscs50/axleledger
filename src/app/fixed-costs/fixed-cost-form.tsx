"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
} from "react";

import {
  createFixedCost,
  updateFixedCost,
} from "./actions";

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

type EditableFixedCost = {
  id: string;
  name: string;
  category: FixedCostCategory;
  amount: number;
  frequency: FixedCostFrequency;
  effective_date: string;
  is_active: boolean;
  notes: string | null;
};

type FixedCostFormProps = {
  editingFixedCost?: EditableFixedCost;
  resetKey?: string;
  editRequested?: boolean;
  defaultDate: string;
};

const categories: Array<{
  value: FixedCostCategory;
  label: string;
}> = [
  {
    value: "truck_payment",
    label: "Truck payment",
  },
  {
    value: "insurance",
    label: "Insurance",
  },
  {
    value: "permits",
    label: "Permits",
  },
  {
    value: "communications",
    label: "Communications",
  },
  {
    value: "subscriptions",
    label: "Subscriptions",
  },
  {
    value: "other",
    label: "Other",
  },
];

export function FixedCostForm({
  editingFixedCost,
  resetKey,
  editRequested = false,
  defaultDate,
}: FixedCostFormProps) {
  const formRef =
    useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (editingFixedCost) {
      return;
    }

    const resetForm = () => {
      const form = formRef.current;

      if (!form) {
        return;
      }

      form.reset();

      const dateField =
        form.elements.namedItem(
          "effective_date",
        );

      if (
        dateField instanceof
        HTMLInputElement
      ) {
        dateField.value = defaultDate;
      }
    };

    resetForm();

    const frame =
      window.requestAnimationFrame(
        resetForm,
      );

    const timeout = window.setTimeout(
      resetForm,
      100,
    );

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [
    defaultDate,
    editingFixedCost,
    resetKey,
  ]);

  return (
    <article
      id="fixed-cost-form"
      className="self-start rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6"
    >
      <p className="text-sm font-semibold text-sky-400">
        {editingFixedCost
          ? "Edit record"
          : "New record"}
      </p>

      <h2 className="mt-1 text-2xl font-black text-white">
        {editingFixedCost
          ? "Edit fixed cost"
          : "Add a fixed cost"}
      </h2>

      {editRequested &&
      !editingFixedCost ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-200"
        >
          That fixed cost could not be
          found. The form has returned to
          create mode.
        </div>
      ) : null}

      <form
        ref={formRef}
        autoComplete="off"
        key={
          editingFixedCost?.id ??
          resetKey ??
          "new-fixed-cost"
        }
        action={
          editingFixedCost
            ? updateFixedCost
            : createFixedCost
        }
        className="mt-6 space-y-5"
      >
        {editingFixedCost ? (
          <input
            type="hidden"
            name="fixed_cost_id"
            value={editingFixedCost.id}
          />
        ) : null}

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Name
          </span>

          <input
            name="name"
            required
            placeholder="Example: Weekly truck payment"
            defaultValue={
              editingFixedCost?.name ?? ""
            }
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Category
          </span>

          <select
            name="category"
            defaultValue={
              editingFixedCost?.category ??
              "truck_payment"
            }
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
          >
            {categories.map(
              (category) => (
                <option
                  key={category.value}
                  value={category.value}
                >
                  {category.label}
                </option>
              ),
            )}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
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
              defaultValue={
                editingFixedCost?.amount ??
                ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              Frequency
            </span>

            <select
              name="frequency"
              defaultValue={
                editingFixedCost
                  ?.frequency ?? "weekly"
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
            >
              <option value="weekly">
                Weekly
              </option>

              <option value="monthly">
                Monthly
              </option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Effective date
          </span>

          <input
            name="effective_date"
            type="date"
            required
            defaultValue={
              editingFixedCost
                ?.effective_date ??
              defaultDate
            }
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
          />
        </label>

        <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
          <input
            name="is_active"
            type="checkbox"
            defaultChecked={
              editingFixedCost
                ? editingFixedCost.is_active
                : true
            }
            className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-500"
          />

          <span>
            <span className="block text-sm font-semibold text-slate-300">
              Active recurring cost
            </span>

            <span className="mt-1 block text-xs leading-5 text-slate-500">
              Active costs are included in
              dashboard profit calculations.
            </span>
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Notes
          </span>

          <textarea
            name="notes"
            rows={4}
            placeholder="Optional fixed-cost details"
            defaultValue={
              editingFixedCost?.notes ?? ""
            }
            className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
          />
        </label>

        <div className="sticky bottom-0 z-10 -mx-5 flex flex-col gap-3 border-t border-slate-800 bg-slate-900/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:flex-row sm:px-6">
          <button
            type="submit"
            className="flex-1 rounded-xl bg-sky-500 px-5 py-3.5 font-black text-white transition hover:bg-sky-400"
          >
            {editingFixedCost
              ? "Update fixed cost"
              : "Save fixed cost"}
          </button>

          {editingFixedCost ? (
            <Link
              href="/fixed-costs#fixed-cost-form"
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
