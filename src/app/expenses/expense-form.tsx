"use client";

import {
  useEffect,
  useRef,
} from "react";
import Link from "next/link";

import {
  createExpense,
  updateExpense,
} from "./actions";

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

type EditableExpense = {
  id: string;
  load_id: string | null;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  vendor: string | null;
  notes: string | null;
};

type LoadOption = {
  id: string;
  load_number: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
};

type ExpenseFormProps = {
  editingExpense?: EditableExpense;
  loads: LoadOption[];
  resetKey?: string;
  editRequested?: boolean;
  defaultDate: string;
};

const categories: Array<{
  value: ExpenseCategory;
  label: string;
}> = [
  {
    value: "tolls",
    label: "Tolls",
  },
  {
    value: "parking",
    label: "Parking",
  },
  {
    value: "scales",
    label: "Scales",
  },
  {
    value: "food",
    label: "Food",
  },
  {
    value: "supplies",
    label: "Supplies",
  },
  {
    value: "other",
    label: "Other",
  },
];

export function ExpenseForm({
  editingExpense,
  loads,
  resetKey,
  editRequested = false,
  defaultDate,
}: ExpenseFormProps) {
  const formRef =
    useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (editingExpense) {
      return;
    }

    const resetCreateForm = () => {
      const form = formRef.current;

      if (!form) {
        return;
      }

      form.reset();

      const dateField =
        form.elements.namedItem(
          "expense_date",
        );

      if (
        dateField instanceof
        HTMLInputElement
      ) {
        dateField.value = defaultDate;
      }
    };

    resetCreateForm();

    const animationFrame =
      window.requestAnimationFrame(
        resetCreateForm,
      );

    const timeout = window.setTimeout(
      resetCreateForm,
      100,
    );

    return () => {
      window.cancelAnimationFrame(
        animationFrame,
      );

      window.clearTimeout(timeout);
    };
  }, [
    defaultDate,
    editingExpense,
    resetKey,
  ]);

  return (
    <article
      id="expense-form"
      className="self-start rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6"
    >
      <p className="text-sm font-semibold text-sky-400">
        {editingExpense
          ? "Edit record"
          : "New record"}
      </p>

      <h2 className="mt-1 text-2xl font-black text-white">
        {editingExpense
          ? "Edit expense"
          : "Add an expense"}
      </h2>

      {editRequested &&
      !editingExpense ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-200"
        >
          That expense could not be found.
          The form has returned to create
          mode.
        </div>
      ) : null}

      <form
        ref={formRef}
        autoComplete="off"
        key={
          editingExpense?.id ??
          resetKey ??
          "new-expense"
        }
        action={
          editingExpense
            ? updateExpense
            : createExpense
        }
        className="mt-6 space-y-5"
      >
        {editingExpense ? (
          <input
            type="hidden"
            name="expense_id"
            value={editingExpense.id}
          />
        ) : null}

        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs leading-5 text-amber-100">
          Record diesel and DEF from{" "}
          <Link
            href="/fuel#fuel-entry"
            className="font-bold text-amber-300 underline underline-offset-2"
          >
            Fuel operations
          </Link>
          {" "}and service work from{" "}
          <Link
            href="/maintenance#maintenance-form"
            className="font-bold text-amber-300 underline underline-offset-2"
          >
            Maintenance
          </Link>
          . Axleledger creates the matching
          expense automatically so structured
          costs are never counted twice.
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Category
          </span>

          <select
            name="category"
            defaultValue={
              editingExpense?.category ??
              "tolls"
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
                editingExpense?.amount ??
                ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              Expense date
            </span>

            <input
              name="expense_date"
              type="date"
              required
              defaultValue={
                editingExpense
                  ?.expense_date ??
                defaultDate
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Vendor
          </span>

          <input
            name="vendor"
            placeholder="Example: Love's Travel Stop"
            defaultValue={
              editingExpense?.vendor ?? ""
            }
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Related load
          </span>

          <select
            name="load_id"
            defaultValue={
              editingExpense?.load_id ?? ""
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

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Link direct costs such as tolls,
            parking, scales, or supplies to the
            load that caused them.
          </p>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Notes
          </span>

          <textarea
            name="notes"
            rows={4}
            placeholder="Optional expense details"
            defaultValue={
              editingExpense?.notes ?? ""
            }
            className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
          />
        </label>

        <div className="sticky bottom-0 z-10 -mx-5 flex flex-col gap-3 border-t border-slate-800 bg-slate-900/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:flex-row sm:px-6">
          <button
            type="submit"
            className="flex-1 rounded-xl bg-sky-500 px-5 py-3.5 font-black text-white transition hover:bg-sky-400"
          >
            {editingExpense
              ? "Update expense"
              : "Save expense"}
          </button>

          {editingExpense ? (
            <Link
              href="/expenses#expense-form"
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
