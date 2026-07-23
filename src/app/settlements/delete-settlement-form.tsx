"use client";

import { deleteSettlement } from "./actions";
import type {
  SettlementStatus,
} from "./types";

type DeleteSettlementFormProps = {
  settlementId: string;
  description: string;
  status: SettlementStatus;
  className?: string;
};

export function DeleteSettlementForm({
  settlementId,
  description,
  status,
  className,
}: DeleteSettlementFormProps) {
  const requiresTypedConfirmation =
    status === "review_needed" ||
    status === "approved" ||
    status === "paid";

  return (
    <form
      action={deleteSettlement}
      onSubmit={(event) => {
        if (requiresTypedConfirmation) {
          const confirmation =
            window.prompt(
              `Permanently delete ${description}? This removes all line items, adjustments, approval snapshots, and audit history. Type DELETE to continue.`,
            );

          if (confirmation !== "DELETE") {
            event.preventDefault();
          }

          return;
        }

        const confirmed =
          window.confirm(
            `Delete ${description}? All related settlement records will also be removed. This cannot be undone.`,
          );

        if (!confirmed) {
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
        className={
          className ??
          "rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-300 transition hover:border-red-400/50 hover:bg-red-400/20"
        }
      >
        Delete
      </button>
    </form>
  );
}
