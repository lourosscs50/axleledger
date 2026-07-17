"use client";

import {
  deleteDefTransaction,
  deleteFuelTransaction,
  deleteTruck,
} from "./actions";

type DeleteRecordFormProps =
  | {
      kind: "fuel";
      recordId: string;
      description: string;
    }
  | {
      kind: "def";
      recordId: string;
      description: string;
    }
  | {
      kind: "truck";
      recordId: string;
      description: string;
    };

export function DeleteRecordForm(
  props: DeleteRecordFormProps,
) {
  const action =
    props.kind === "fuel"
      ? deleteFuelTransaction
      : props.kind === "def"
        ? deleteDefTransaction
        : deleteTruck;

  const fieldName =
    props.kind === "truck"
      ? "truck_id"
      : "transaction_id";

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmed =
          window.confirm(
            `Delete ${props.description}? This cannot be undone.`,
          );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input
        type="hidden"
        name={fieldName}
        value={props.recordId}
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
