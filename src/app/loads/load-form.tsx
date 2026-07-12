import Link from "next/link";

import {
  createLoad,
  updateLoad,
} from "./actions";

type LoadStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled";

type EditableLoad = {
  id: string;
  load_number: string;
  carrier_or_broker: string | null;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  pickup_date: string;
  delivery_date: string | null;
  gross_revenue: number;
  loaded_miles: number;
  deadhead_miles: number;
  status: LoadStatus;
  notes: string | null;
};

type LoadFormProps = {
  editingLoad?: EditableLoad;
  resetKey?: string;
  editRequested?: boolean;
};

export function LoadForm({
  editingLoad,
  resetKey,
  editRequested = false,
}: LoadFormProps) {
  return (
    <article
      id="load-form"
      className="self-start rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6"
    >
      <p className="text-sm font-semibold text-sky-400">
        {editingLoad
          ? "Edit record"
          : "New record"}
      </p>

      <h2 className="mt-1 text-2xl font-black text-white">
        {editingLoad
          ? `Edit ${editingLoad.load_number}`
          : "Add a load"}
      </h2>

      {editRequested && !editingLoad ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-200"
        >
          That load could not be found. The
          form has returned to create mode.
        </div>
      ) : null}

      <form
        autoComplete="off"
        key={
          editingLoad?.id ??
          resetKey ??
          "new-load"
        }
        action={
          editingLoad
            ? updateLoad
            : createLoad
        }
        className="mt-6 space-y-5"
      >
        {editingLoad ? (
          <input
            type="hidden"
            name="load_id"
            value={editingLoad.id}
          />
        ) : null}

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Load number
          </span>

          <input
            name="load_number"
            required
            placeholder="Example: AL-1001"
            defaultValue={
              editingLoad?.load_number ?? ""
            }
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Carrier or broker
          </span>

          <input
            name="carrier_or_broker"
            placeholder="Optional"
            defaultValue={
              editingLoad?.carrier_or_broker ??
              ""
            }
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-[1fr_90px]">
          <label>
            <span className="text-sm font-semibold text-slate-300">
              Origin city
            </span>

            <input
              name="origin_city"
              required
              defaultValue={
                editingLoad?.origin_city ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              State
            </span>

            <input
              name="origin_state"
              required
              minLength={2}
              maxLength={2}
              placeholder="TX"
              defaultValue={
                editingLoad?.origin_state ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 uppercase text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_90px]">
          <label>
            <span className="text-sm font-semibold text-slate-300">
              Destination city
            </span>

            <input
              name="destination_city"
              required
              defaultValue={
                editingLoad?.destination_city ??
                ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              State
            </span>

            <input
              name="destination_state"
              required
              minLength={2}
              maxLength={2}
              placeholder="GA"
              defaultValue={
                editingLoad?.destination_state ??
                ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 uppercase text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-sm font-semibold text-slate-300">
              Pickup date
            </span>

            <input
              name="pickup_date"
              type="date"
              required
              defaultValue={
                editingLoad?.pickup_date ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              Delivery date
            </span>

            <input
              name="delivery_date"
              type="date"
              defaultValue={
                editingLoad?.delivery_date ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Gross revenue
          </span>

          <input
            name="gross_revenue"
            type="number"
            min="0"
            step="0.01"
            defaultValue={
              editingLoad?.gross_revenue ?? 0
            }
            required
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-sm font-semibold text-slate-300">
              Loaded miles
            </span>

            <input
              name="loaded_miles"
              type="number"
              min="0"
              step="1"
              defaultValue={
                editingLoad?.loaded_miles ?? 0
              }
              required
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              Deadhead miles
            </span>

            <input
              name="deadhead_miles"
              type="number"
              min="0"
              step="1"
              defaultValue={
                editingLoad?.deadhead_miles ?? 0
              }
              required
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Status
          </span>

          <select
            name="status"
            defaultValue={
              editingLoad?.status ?? "planned"
            }
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
          >
            <option value="planned">
              Planned
            </option>

            <option value="in_progress">
              In progress
            </option>

            <option value="completed">
              Completed
            </option>

            <option value="cancelled">
              Cancelled
            </option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Notes
          </span>

          <textarea
            name="notes"
            rows={4}
            placeholder="Optional load details"
            defaultValue={
              editingLoad?.notes ?? ""
            }
            className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
          />
        </label>

        <div className="sticky bottom-0 z-10 -mx-5 flex flex-col gap-3 border-t border-slate-800 bg-slate-900/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:flex-row sm:px-6">
          <button
            type="submit"
            className="flex-1 rounded-xl bg-sky-500 px-5 py-3.5 font-black text-white transition hover:bg-sky-400"
          >
            {editingLoad
              ? "Update load"
              : "Save load"}
          </button>

          {editingLoad ? (
            <Link
              href="/loads#load-form"
              className="rounded-xl border border-slate-700 bg-slate-950 px-5 py-3.5 text-center font-bold text-slate-300 transition hover:border-slate-600 hover:text-white"
            >
              Cancel
            </Link>
          ) : null}
        </div>
      </form>
    </article>
  );
}
