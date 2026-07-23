"use client";

import {
  unlinkSettlementExpense,
} from "./actions";

type UnlinkExpenseFormProps = {
  settlementId: string;
  lineItemId: string;
  description: string;
};

export function UnlinkExpenseForm({
  settlementId,
  lineItemId,
  description,
}: UnlinkExpenseFormProps) {
  return (
    <form
      action={unlinkSettlementExpense}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Unlink ${description} from this settlement? The original expense will remain in Axleledger.`,
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
        type="hidden"
        name="line_item_id"
        value={lineItemId}
      />

      <button
        type="submit"
        className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-300 transition hover:bg-amber-400/20"
      >
        Unlink expense
      </button>
    </form>
  );
}
