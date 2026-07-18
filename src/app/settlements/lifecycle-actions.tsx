"use client";

import {
  approveSettlement,
  markSettlementPaid,
  reopenSettlement,
  returnSettlementToDraft,
  submitSettlementForReview,
} from "./actions";
import type {
  SettlementStatus,
} from "./types";

type LifecycleActionsProps = {
  settlementId: string;
  status: SettlementStatus;
};

export function LifecycleActions({
  settlementId,
  status,
}: LifecycleActionsProps) {
  if (
    status === "draft" ||
    status === "reopened"
  ) {
    return (
      <form
        action={submitSettlementForReview}
        onSubmit={(event) => {
          if (
            !window.confirm(
              "Submit this settlement for review? Line items will be locked until it is returned or reopened.",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input
          type="hidden"
          name="settlement_id"
          value={settlementId}
        />

        <button
          type="submit"
          className="rounded-xl bg-sky-500 px-5 py-3 font-black text-white transition hover:bg-sky-400"
        >
          Submit for review
        </button>
      </form>
    );
  }

  if (status === "review_needed") {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        <form
          action={approveSettlement}
          onSubmit={(event) => {
            if (
              !window.confirm(
                "Approve this settlement and preserve an immutable snapshot?",
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input
            type="hidden"
            name="settlement_id"
            value={settlementId}
          />

          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-500 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-400"
          >
            Approve settlement
          </button>
        </form>

        <form
          action={returnSettlementToDraft}
          className="grid gap-3"
        >
          <input
            type="hidden"
            name="settlement_id"
            value={settlementId}
          />

          <input
            name="reason"
            required
            placeholder="Reason for returning to draft"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-amber-400"
          />

          <button
            type="submit"
            className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-3 font-black text-amber-300 transition hover:bg-amber-400/20"
          >
            Return to draft
          </button>
        </form>
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        <form
          action={markSettlementPaid}
          onSubmit={(event) => {
            if (
              !window.confirm(
                "Confirm that this settlement was paid?",
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input
            type="hidden"
            name="settlement_id"
            value={settlementId}
          />

          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-500 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-400"
          >
            Mark paid
          </button>
        </form>

        <ReopenForm
          settlementId={settlementId}
        />
      </div>
    );
  }

  return (
    <ReopenForm
      settlementId={settlementId}
    />
  );
}

function ReopenForm({
  settlementId,
}: {
  settlementId: string;
}) {
  return (
    <form
      action={reopenSettlement}
      className="grid gap-3"
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Reopen this settlement for correction? The current approval snapshot will remain in history.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input
        type="hidden"
        name="settlement_id"
        value={settlementId}
      />

      <input
        name="reason"
        required
        placeholder="Reason for reopening"
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-amber-400"
      />

      <button
        type="submit"
        className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-3 font-black text-amber-300 transition hover:bg-amber-400/20"
      >
        Reopen for correction
      </button>
    </form>
  );
}
