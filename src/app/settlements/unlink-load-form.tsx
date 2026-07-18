"use client";

import { unlinkSettlementLoad } from "./actions";

type UnlinkLoadFormProps = {
  settlementId: string;
  loadId: string;
  loadNumber: string;
};

export function UnlinkLoadForm({
  settlementId,
  loadId,
  loadNumber,
}: UnlinkLoadFormProps) {
  return (
    <form
      action={unlinkSettlementLoad}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Remove load ${loadNumber} from this settlement?`,
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
        name="load_id"
        value={loadId}
      />

      <button
        type="submit"
        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-400 transition hover:text-white"
      >
        Remove
      </button>
    </form>
  );
}
