"use client";

import { deleteFixedCost } from "./actions";

type DeleteFixedCostFormProps = {
  fixedCostId: string;
  description: string;
};

export function DeleteFixedCostForm({
  fixedCostId,
  description,
}: DeleteFixedCostFormProps) {
  return (
    <form
      action={deleteFixedCost}
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
        name="fixed_cost_id"
        value={fixedCostId}
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
