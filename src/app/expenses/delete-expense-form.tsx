"use client";

import { deleteExpense } from "./actions";

type DeleteExpenseFormProps = {
  expenseId: string;
  description: string;
};

export function DeleteExpenseForm({
  expenseId,
  description,
}: DeleteExpenseFormProps) {
  return (
    <form
      action={deleteExpense}
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
        name="expense_id"
        value={expenseId}
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
