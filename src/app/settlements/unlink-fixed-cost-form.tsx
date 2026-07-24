"use client";

import {
  unlinkSettlementFixedCost,
} from "./actions";

type UnlinkFixedCostFormProps = {
  settlementId: string;
  lineItemId: string;
  description: string;
};

export function UnlinkFixedCostForm({
  settlementId,
  lineItemId,
  description,
}: UnlinkFixedCostFormProps) {
  return (
    <form
      action={unlinkSettlementFixedCost}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Unlink ${description} from this settlement? The recurring fixed-cost record will remain in Axleledger.`,
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
        className="rounded-lg border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-xs font-bold text-violet-300 transition hover:bg-violet-400/20"
      >
        Unlink fixed cost
      </button>
    </form>
  );
}
