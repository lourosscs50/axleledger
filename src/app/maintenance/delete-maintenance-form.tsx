"use client";

import { deleteMaintenanceRecord } from "./actions";

type DeleteMaintenanceFormProps = {
  recordId: string;
  description: string;
};

export function DeleteMaintenanceForm({
  recordId,
  description,
}: DeleteMaintenanceFormProps) {
  return (
    <form
      action={deleteMaintenanceRecord}
      onSubmit={(event) => {
        const confirmed =
          window.confirm(
            `Delete ${description}? Its linked maintenance expense will also be deleted. This cannot be undone.`,
          );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input
        type="hidden"
        name="maintenance_record_id"
        value={recordId}
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
