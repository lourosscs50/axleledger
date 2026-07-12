"use client";

import { deleteLoad } from "./actions";

type DeleteLoadFormProps = {
  loadId: string;
  loadNumber: string;
};

export function DeleteLoadForm({
  loadId,
  loadNumber,
}: DeleteLoadFormProps) {
  return (
    <form
      action={deleteLoad}
      onSubmit={(event) => {
        const confirmed =
          window.confirm(
            `Delete load ${loadNumber}? This cannot be undone.`,
          );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input
        type="hidden"
        name="load_id"
        value={loadId}
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
