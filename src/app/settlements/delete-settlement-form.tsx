"use client";

import { deleteSettlement } from "./actions";

type DeleteSettlementFormProps = {
  settlementId: string;
  description: string;
};

export function DeleteSettlementForm({
  settlementId,
  description,
}: DeleteSettlementFormProps) {
  return (
    <form
      action={deleteSettlement}
      onSubmit={(event) => {
        const confirmed =
          window.confirm(
            `Delete ${description}? This cannot be undone.`,
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
        className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-300 transition hover:border-red-400/50 hover:bg-red-400/20"
      >
        Delete
      </button>
    </form>
  );
}
