"use client";

import Link from "next/link";
import {
  useState,
} from "react";

import {
  createMaintenanceRecord,
  updateMaintenanceRecord,
} from "./actions";
import type {
  LoadOption,
  MaintenanceCategory,
  MaintenanceRecord,
  MaintenanceStatus,
  TruckOption,
} from "./types";

type MaintenanceFormProps = {
  editingRecord?: MaintenanceRecord;
  trucks: TruckOption[];
  loads: LoadOption[];
  defaultDate: string;
  resetKey?: string;
  editRequested?: boolean;
};

const categories: Array<{
  value: Exclude<
    MaintenanceCategory,
    "legacy"
  >;
  label: string;
}> = [
  {
    value: "preventive",
    label: "Preventive maintenance",
  },
  {
    value: "repair",
    label: "Repair",
  },
  {
    value: "tires",
    label: "Tires",
  },
  {
    value: "inspection",
    label: "Inspection",
  },
  {
    value: "fluids",
    label: "Fluids and filters",
  },
  {
    value: "brakes",
    label: "Brakes",
  },
  {
    value: "electrical",
    label: "Electrical",
  },
  {
    value: "engine",
    label: "Engine",
  },
  {
    value: "transmission",
    label: "Transmission",
  },
  {
    value: "suspension",
    label: "Suspension",
  },
  {
    value: "emissions",
    label: "Emissions",
  },
  {
    value: "other",
    label: "Other",
  },
];

export function MaintenanceForm({
  editingRecord,
  trucks,
  loads,
  defaultDate,
  resetKey,
  editRequested = false,
}: MaintenanceFormProps) {
  const [status, setStatus] =
    useState<MaintenanceStatus>(
      editingRecord?.status ??
        "scheduled",
    );

  const [
    warrantyCovered,
    setWarrantyCovered,
  ] = useState(
    editingRecord?.warranty_covered ??
      false,
  );

  const completedLocked =
    editingRecord?.status ===
    "completed";

  return (
    <article
      id="maintenance-form"
      className="self-start rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6"
    >
      <p className="text-sm font-semibold text-sky-400">
        {editingRecord
          ? "Edit service"
          : "Maintenance entry"}
      </p>

      <h2 className="mt-1 text-2xl font-black text-white">
        {editingRecord
          ? "Update maintenance"
          : "Schedule or record service"}
      </h2>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        Scheduled work creates no expense.
        Completed work creates or updates
        exactly one maintenance expense from
        the cost breakdown.
      </p>

      {editRequested &&
      !editingRecord ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-200"
        >
          That maintenance record could not be
          found. The form has returned to create
          mode.
        </div>
      ) : null}

      <form
        key={
          editingRecord?.id ??
          resetKey ??
          "new-maintenance"
        }
        action={
          editingRecord
            ? updateMaintenanceRecord
            : createMaintenanceRecord
        }
        autoComplete="off"
        className="mt-6 space-y-6"
      >
        {editingRecord ? (
          <input
            type="hidden"
            name="maintenance_record_id"
            value={editingRecord.id}
          />
        ) : null}

        {completedLocked ? (
          <input
            type="hidden"
            name="status"
            value="completed"
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-sm font-semibold text-slate-300">
              Status
            </span>

            <select
              name="status"
              value={status}
              disabled={completedLocked}
              onChange={(event) => {
                setStatus(
                  event.target
                    .value as MaintenanceStatus,
                );

                if (
                  event.target.value ===
                  "scheduled"
                ) {
                  setWarrantyCovered(false);
                }
              }}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-70 focus:border-sky-400"
            >
              <option value="scheduled">
                Scheduled
              </option>

              <option value="completed">
                Completed
              </option>
            </select>

            {completedLocked ? (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Completed service can be
                corrected, but it cannot return
                to scheduled status.
              </p>
            ) : null}
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              Truck
            </span>

            <select
              name="truck_id"
              required={
                !editingRecord?.is_legacy
              }
              defaultValue={
                editingRecord?.truck_id ??
                trucks.find(
                  (truck) =>
                    truck.is_active,
                )?.id ??
                ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
            >
              <option value="">
                {editingRecord?.is_legacy
                  ? "Unassigned legacy record"
                  : "Select a truck"}
              </option>

              {trucks.map((truck) => (
                <option
                  key={truck.id}
                  value={truck.id}
                >
                  Unit {truck.unit_number}
                  {" · "}
                  {truck.year
                    ? `${truck.year} `
                    : ""}
                  {truck.make} {truck.model}
                  {truck.is_active
                    ? ""
                    : " · Inactive"}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Service category
          </span>

          <select
            name="service_category"
            defaultValue={
              editingRecord
                ?.service_category ??
              "preventive"
            }
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
          >
            {editingRecord
              ?.service_category ===
            "legacy" ? (
              <option value="legacy">
                Imported V1 maintenance
              </option>
            ) : null}

            {categories.map(
              (category) => (
                <option
                  key={category.value}
                  value={category.value}
                >
                  {category.label}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Work description
          </span>

          <textarea
            name="work_description"
            rows={3}
            required
            placeholder="Example: Engine oil, oil filter, and fuel filters"
            defaultValue={
              editingRecord
                ?.work_description ?? ""
            }
            className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-sm font-semibold text-slate-300">
              Vendor or shop
            </span>

            <input
              name="vendor"
              placeholder="Example: Rush Truck Center"
              defaultValue={
                editingRecord?.vendor ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-300">
              Related load
            </span>

            <select
              name="load_id"
              defaultValue={
                editingRecord?.load_id ?? ""
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
            >
              <option value="">
                No specific load
              </option>

              {loads.map((load) => (
                <option
                  key={load.id}
                  value={load.id}
                >
                  {load.load_number}
                  {" · "}
                  {load.origin_city},{" "}
                  {load.origin_state}
                  {" → "}
                  {load.destination_city},{" "}
                  {
                    load.destination_state
                  }
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
          <legend className="px-2 text-sm font-black text-white">
            Schedule target
          </legend>

          <p className="mb-4 text-xs leading-5 text-slate-500">
            Scheduled maintenance requires a due
            date, an odometer target, or both.
            Completed service may keep the
            original schedule for history.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-semibold text-slate-300">
                Scheduled date
              </span>

              <input
                name="scheduled_date"
                type="date"
                defaultValue={
                  editingRecord
                    ?.scheduled_date ??
                  (status === "scheduled"
                    ? defaultDate
                    : "")
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-slate-300">
                Scheduled odometer
              </span>

              <input
                name="scheduled_odometer"
                type="number"
                min="0"
                step="1"
                placeholder="Example: 30000"
                defaultValue={
                  editingRecord
                    ?.scheduled_odometer ?? ""
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
              />
            </label>
          </div>
        </fieldset>

        <fieldset
          disabled={status !== "completed"}
          className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 disabled:opacity-60"
        >
          <legend className="px-2 text-sm font-black text-white">
            Completed service
          </legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-semibold text-slate-300">
                Completion date
              </span>

              <input
                name="completed_date"
                type="date"
                required={
                  status === "completed"
                }
                defaultValue={
                  editingRecord
                    ?.completed_date ??
                  defaultDate
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-slate-300">
                Service odometer
              </span>

              <input
                name="odometer"
                type="number"
                min="0"
                step="1"
                placeholder="Example: 25235"
                defaultValue={
                  editingRecord?.odometer ?? ""
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
              />
            </label>
          </div>
        </fieldset>

        <fieldset
          disabled={status !== "completed"}
          className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 disabled:opacity-60"
        >
          <legend className="px-2 text-sm font-black text-white">
            Cost breakdown
          </legend>

          <p className="mb-4 text-xs leading-5 text-slate-500">
            Axleledger totals these values and
            synchronizes one maintenance expense.
            Zero-cost warranty work remains in
            maintenance history without creating
            a financial expense.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-semibold text-slate-300">
                Parts
              </span>

              <input
                name="parts_cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                defaultValue={
                  editingRecord?.parts_cost ??
                  "0"
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-slate-300">
                Labor
              </span>

              <input
                name="labor_cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                defaultValue={
                  editingRecord?.labor_cost ??
                  "0"
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-slate-300">
                Tax
              </span>

              <input
                name="tax_cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                defaultValue={
                  editingRecord?.tax_cost ??
                  "0"
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-slate-300">
                Other
              </span>

              <input
                name="other_cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                defaultValue={
                  editingRecord?.other_cost ??
                  "0"
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
              />
            </label>
          </div>
        </fieldset>

        <fieldset
          disabled={status !== "completed"}
          className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 disabled:opacity-60"
        >
          <legend className="px-2 text-sm font-black text-white">
            Next service
          </legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-semibold text-slate-300">
                Next-service date
              </span>

              <input
                name="next_service_date"
                type="date"
                defaultValue={
                  editingRecord
                    ?.next_service_date ?? ""
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-slate-300">
                Next-service odometer
              </span>

              <input
                name="next_service_odometer"
                type="number"
                min="0"
                step="1"
                placeholder="Example: 40000"
                defaultValue={
                  editingRecord
                    ?.next_service_odometer ??
                  ""
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
              />
            </label>
          </div>
        </fieldset>

        <fieldset
          disabled={status !== "completed"}
          className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 disabled:opacity-60"
        >
          <legend className="px-2 text-sm font-black text-white">
            Warranty
          </legend>

          <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
            <input
              name="warranty_covered"
              type="checkbox"
              checked={warrantyCovered}
              onChange={(event) => {
                setWarrantyCovered(
                  event.target.checked,
                );
              }}
              className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-500"
            />

            <span>
              <span className="block text-sm font-semibold text-slate-300">
                Warranty coverage recorded
              </span>

              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Track the provider, claim, and
                expiration limits tied to this
                service.
              </span>
            </span>
          </label>

          <div
            className={
              warrantyCovered
                ? "mt-4 grid gap-4 sm:grid-cols-2"
                : "mt-4 grid gap-4 opacity-50 sm:grid-cols-2"
            }
          >
            <label>
              <span className="text-sm font-semibold text-slate-300">
                Warranty provider
              </span>

              <input
                name="warranty_provider"
                disabled={!warrantyCovered}
                placeholder="Example: Peterbilt"
                defaultValue={
                  editingRecord
                    ?.warranty_provider ?? ""
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-slate-300">
                Claim or authorization
              </span>

              <input
                name="warranty_claim_number"
                disabled={!warrantyCovered}
                placeholder="Optional reference"
                defaultValue={
                  editingRecord
                    ?.warranty_claim_number ??
                  ""
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-slate-300">
                Expiration date
              </span>

              <input
                name="warranty_expiration_date"
                type="date"
                disabled={!warrantyCovered}
                defaultValue={
                  editingRecord
                    ?.warranty_expiration_date ??
                  ""
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-slate-300">
                Expiration odometer
              </span>

              <input
                name="warranty_expiration_odometer"
                type="number"
                min="0"
                step="1"
                disabled={!warrantyCovered}
                placeholder="Optional mileage limit"
                defaultValue={
                  editingRecord
                    ?.warranty_expiration_odometer ??
                  ""
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
              />
            </label>
          </div>
        </fieldset>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">
            Notes
          </span>

          <textarea
            name="notes"
            rows={4}
            placeholder="Parts used, service findings, or follow-up details"
            defaultValue={
              editingRecord?.notes ?? ""
            }
            className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
          />
        </label>

        <div className="sticky bottom-0 z-10 -mx-5 flex flex-col gap-3 border-t border-slate-800 bg-slate-900/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:flex-row sm:px-6">
          <button
            type="submit"
            disabled={
              trucks.length === 0 &&
              !editingRecord?.is_legacy
            }
            className="flex-1 rounded-xl bg-sky-500 px-5 py-3.5 font-black text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {editingRecord
              ? "Update maintenance"
              : status === "completed"
                ? "Save completed service"
                : "Schedule maintenance"}
          </button>

          {editingRecord ? (
            <Link
              href="/maintenance#maintenance-form"
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
