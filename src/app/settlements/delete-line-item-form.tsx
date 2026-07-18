"use client";

import { deleteSettlementLineItem } from "./actions";

type DeleteLineItemFormProps = {
  settlementId: string;
  lineItemId: string;
  description: string;
};

export function DeleteLineItemForm({
  settlementId,
  lineItemId,
  description,
}: DeleteLineItemFormProps) {
  return (
    <form
      action={deleteSettlementLineItem}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Delete ${description}?`,
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
        className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-400/20"
      >
        Delete
      </button>
    </form>
  );
}
