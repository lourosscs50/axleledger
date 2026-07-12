"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
} from "react";

import {
  createSettlement,
  updateSettlement,
} from "./actions";

type EditableSettlement = {
  id: string;
  settlement_date: string;
  carrier_or_company: string | null;
  gross_pay: number;
  deductions: number;
  reimbursements: number;
  net_deposit: number;
  notes: string | null;
};

type SettlementFormProps = {
  editingSettlement?: EditableSettlement;
  resetKey?: string;
  editRequested?: boolean;
  defaultDate: string;
};

export function SettlementForm({
  editingSettlement,
  resetKey,
  editRequested = false,
  defaultDate,
}: SettlementFormProps) {
  const formRef =
    useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (editingSettlement) {
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
          "settlement_date",
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
    editingSettlement,
    resetKey,
  ]);

  return (
    <article
      id="settlement-form"
      className="self-start rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6"
    >
      <p className="text-sm font-semibold text-sky-400">
        {editingSettlement
          ? "Edit record"
          : "New record"}
      </p>

      <h2 className="mt-1 text-2xl font-black text-white">
        {editingSettlement
          ? "Edit settlement"
          : "Add a settlement"}
      </h2>

      {editRequested &&
      !editingSettlement ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-200"
        >
          That settlement could not be
          found. The form has returned to
          create mode.
        </div>
      ) : null}

      <form
        ref={formRef}
        autoComplete="off"
        key={
          editingSettlement?.id ??
          resetKey ??
          "new-settlement"
        }
        action={
          editingSettlement
            ? updateSettlement
            : createSettlement
        }
        className="mt-6 space-y-5"
      >
        {editingSettlement ? (
          <input
            type="hidden"
            name="settlement_id"
            value={editingSettlement.id}
          />
        ) : null}

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Settlement date
          </span>

          <input
            name="settlement_date"
            type="date"
            required
            defaultValue={
              editingSettlement
                ?.settlement_date ??
              defaultDate
            }
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Carrier or company
          </span>

          <input
            name="carrier_or_company"
            placeholder="Example: ABC Logistics"
            defaultValue={
              editingSettlement
                ?.carrier_or_company ?? ""
            }
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-sm font-semibold text-slate-300">
              Gross pay
            </span>

            <input
              name="gross_pay"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="0.00"
              defaultValue={
                editingSettlement
                  ?.gross_pay ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              Deductions
            </span>

            <input
              name="deductions"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="0.00"
              defaultValue={
                editingSettlement
                  ?.deductions ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              Reimbursements
            </span>

            <input
              name="reimbursements"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="0.00"
              defaultValue={
                editingSettlement
                  ?.reimbursements ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              Net deposit
            </span>

            <input
              name="net_deposit"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="0.00"
              defaultValue={
                editingSettlement
                  ?.net_deposit ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>
        </div>

        <p className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs leading-5 text-slate-500">
          Enter the numbers exactly as they
          appear on the settlement statement.
          Net deposit may include adjustments
          not represented by the basic fields.
        </p>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Notes
          </span>

          <textarea
            name="notes"
            rows={4}
            placeholder="Optional settlement details"
            defaultValue={
              editingSettlement?.notes ?? ""
            }
            className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
          />
        </label>

        <div className="sticky bottom-0 z-10 -mx-5 flex flex-col gap-3 border-t border-slate-800 bg-slate-900/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:flex-row sm:px-6">
          <button
            type="submit"
            className="flex-1 rounded-xl bg-sky-500 px-5 py-3.5 font-black text-white transition hover:bg-sky-400"
          >
            {editingSettlement
              ? "Update settlement"
              : "Save settlement"}
          </button>

          {editingSettlement ? (
            <Link
              href="/settlements#settlement-form"
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
