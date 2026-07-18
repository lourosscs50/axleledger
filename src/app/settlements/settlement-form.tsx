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
import type {
  SettlementRecord,
} from "./types";

type SettlementFormProps = {
  editingSettlement?: SettlementRecord;
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
          ? "Edit metadata"
          : "New workflow"}
      </p>

      <h2 className="mt-1 text-2xl font-black text-white">
        {editingSettlement
          ? "Edit settlement"
          : "Create a draft settlement"}
      </h2>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        Financial totals are calculated from
        settlement line items. Approved values
        cannot be silently overwritten.
      </p>

      {editRequested &&
      !editingSettlement ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-200"
        >
          That settlement is not editable or
          could not be found. The form has
          returned to create mode.
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

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-sm font-semibold text-slate-300">
              Statement number
            </span>

            <input
              name="statement_number"
              placeholder="Optional"
              defaultValue={
                editingSettlement
                  ?.statement_number ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>

          <label>
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
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Carrier or company
          </span>

          <input
            name="carrier_or_company"
            placeholder="Example: Apex Freight"
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
              Period start
            </span>

            <input
              name="period_start_date"
              type="date"
              defaultValue={
                editingSettlement
                  ?.period_start_date ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              Period end
            </span>

            <input
              name="period_end_date"
              type="date"
              defaultValue={
                editingSettlement
                  ?.period_end_date ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Notes
          </span>

          <textarea
            name="notes"
            rows={4}
            placeholder="Statement details, exceptions, or review notes"
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
              ? "Update metadata"
              : "Create draft"}
          </button>

          {editingSettlement ? (
            <Link
              href={`/settlements?manage=${editingSettlement.id}#settlement-workspace`}
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
