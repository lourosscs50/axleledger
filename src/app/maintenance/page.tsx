import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { DeleteMaintenanceForm } from "./delete-maintenance-form";
import { MaintenanceForm } from "./maintenance-form";
import type {
  LoadOption,
  MaintenanceCategory,
  MaintenanceRecord,
  TruckOption,
} from "./types";

export const metadata: Metadata = {
  title: "Maintenance",
  description:
    "Schedule service, track completed maintenance, warranties, and linked expenses.",
};

type OdometerRecord = {
  truck_id: string | null;
  odometer: number | null;
};

type MaintenancePageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    edit?: string;
    saved?: string;
  }>;
};

type DueTone =
  | "scheduled"
  | "due_soon"
  | "overdue"
  | "completed";

type DueAssessment = {
  tone: DueTone;
  label: string;
  detail: string;
};

const currencyFormatter =
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

const numberFormatter =
  new Intl.NumberFormat("en-US");

const dateFormatter =
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

const defaultDateFormatter =
  new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Chicago",
  });

const categoryLabels: Record<
  MaintenanceCategory,
  string
> = {
  preventive: "Preventive",
  repair: "Repair",
  tires: "Tires",
  inspection: "Inspection",
  fluids: "Fluids and filters",
  brakes: "Brakes",
  electrical: "Electrical",
  engine: "Engine",
  transmission: "Transmission",
  suspension: "Suspension",
  emissions: "Emissions",
  other: "Other",
  legacy: "Imported V1",
};

const dueStyles: Record<
  DueTone,
  string
> = {
  scheduled:
    "border-sky-400/20 bg-sky-400/10 text-sky-300",
  due_soon:
    "border-amber-400/20 bg-amber-400/10 text-amber-300",
  overdue:
    "border-red-400/20 bg-red-400/10 text-red-300",
  completed:
    "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
};

function formatCurrency(value: number) {
  return currencyFormatter.format(
    Number(value),
  );
}

function formatNumber(
  value: number | null,
) {
  return value === null
    ? "—"
    : numberFormatter.format(
        Number(value),
      );
}

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "Not set";
  }

  return dateFormatter.format(
    new Date(`${value}T00:00:00Z`),
  );
}

function getDefaultDate() {
  const parts =
    defaultDateFormatter.formatToParts(
      new Date(),
    );

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ]),
  ) as Record<string, string>;

  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(
  value: string,
  amount: number,
) {
  const date = new Date(
    `${value}T00:00:00Z`,
  );

  date.setUTCDate(
    date.getUTCDate() + amount,
  );

  return date.toISOString().slice(0, 10);
}

function updateOdometer(
  map: Map<string, number>,
  record: OdometerRecord,
) {
  if (
    !record.truck_id ||
    record.odometer === null
  ) {
    return;
  }

  const value = Number(record.odometer);
  const current =
    map.get(record.truck_id) ?? 0;

  if (value > current) {
    map.set(record.truck_id, value);
  }
}

function getDueAssessment(
  record: MaintenanceRecord,
  currentOdometer: number | null,
  today: string,
): DueAssessment {
  if (
    record.status === "completed" &&
    !record.next_service_date &&
    record.next_service_odometer ===
      null
  ) {
    return {
      tone: "completed",
      label: "Completed",
      detail: `Completed ${formatDate(
        record.completed_date,
      )}`,
    };
  }

  const targetDate =
    record.status === "scheduled"
      ? record.scheduled_date
      : record.next_service_date;

  const targetOdometer =
    record.status === "scheduled"
      ? record.scheduled_odometer
      : record.next_service_odometer;

  const overdueByDate =
    Boolean(
      targetDate &&
        targetDate < today,
    );

  const overdueByOdometer =
    targetOdometer !== null &&
    currentOdometer !== null &&
    currentOdometer >=
      targetOdometer;

  if (
    overdueByDate ||
    overdueByOdometer
  ) {
    const reasons = [
      overdueByDate && targetDate
        ? `due ${formatDate(targetDate)}`
        : null,
      overdueByOdometer &&
      targetOdometer !== null
        ? `due at ${formatNumber(
            targetOdometer,
          )} miles`
        : null,
    ].filter(Boolean);

    return {
      tone: "overdue",
      label:
        record.status === "scheduled"
          ? "Overdue"
          : "Next service overdue",
      detail: reasons.join(" · "),
    };
  }

  const dueSoonByDate =
    Boolean(
      targetDate &&
        targetDate <=
          addDays(today, 14),
    );

  const dueSoonByOdometer =
    targetOdometer !== null &&
    currentOdometer !== null &&
    targetOdometer >
      currentOdometer &&
    targetOdometer <=
      currentOdometer + 1000;

  if (
    dueSoonByDate ||
    dueSoonByOdometer
  ) {
    const reasons = [
      dueSoonByDate && targetDate
        ? `due ${formatDate(targetDate)}`
        : null,
      dueSoonByOdometer &&
      targetOdometer !== null
        ? `${formatNumber(
            targetOdometer -
              (currentOdometer ?? 0),
          )} miles remaining`
        : null,
    ].filter(Boolean);

    return {
      tone: "due_soon",
      label:
        record.status === "scheduled"
          ? "Due soon"
          : "Next service due soon",
      detail: reasons.join(" · "),
    };
  }

  if (record.status === "scheduled") {
    return {
      tone: "scheduled",
      label: "Scheduled",
      detail: [
        targetDate
          ? formatDate(targetDate)
          : null,
        targetOdometer !== null
          ? `${formatNumber(
              targetOdometer,
            )} miles`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }

  return {
    tone: "completed",
    label: "Completed",
    detail: [
      targetDate
        ? `Next ${formatDate(
            targetDate,
          )}`
        : null,
      targetOdometer !== null
        ? `Next ${formatNumber(
            targetOdometer,
          )} miles`
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export default async function MaintenancePage({
  searchParams,
}: MaintenancePageProps) {
  const {
    error,
    success,
    edit,
    saved,
  } = await searchParams;

  const supabase = await createClient();

  const { data: claimsData } =
    await supabase.auth.getClaims();

  const userId =
    typeof claimsData?.claims?.sub ===
    "string"
      ? claimsData.claims.sub
      : null;

  if (!userId) {
    redirect("/login");
  }

  const [
    {
      data: trucksData,
      error: trucksError,
    },
    {
      data: loadsData,
      error: loadsError,
    },
    {
      data: maintenanceData,
      error: maintenanceError,
    },
    {
      data: fuelOdometerData,
      error: fuelOdometerError,
    },
    {
      data: defOdometerData,
      error: defOdometerError,
    },
  ] = await Promise.all([
    supabase
      .from("trucks")
      .select(
        `
          id,
          unit_number,
          year,
          make,
          model,
          is_active
        `,
      )
      .eq("user_id", userId)
      .order("is_active", {
        ascending: false,
      })
      .order("unit_number", {
        ascending: true,
      }),
    supabase
      .from("loads")
      .select(
        `
          id,
          load_number,
          origin_city,
          origin_state,
          destination_city,
          destination_state
        `,
      )
      .eq("user_id", userId)
      .order("pickup_date", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      }),
    supabase
      .from("maintenance_records")
      .select(
        `
          id,
          expense_id,
          truck_id,
          load_id,
          status,
          service_category,
          work_description,
          vendor,
          scheduled_date,
          scheduled_odometer,
          completed_date,
          odometer,
          parts_cost,
          labor_cost,
          tax_cost,
          other_cost,
          total_cost,
          next_service_date,
          next_service_odometer,
          warranty_covered,
          warranty_provider,
          warranty_claim_number,
          warranty_expiration_date,
          warranty_expiration_odometer,
          notes,
          is_legacy,
          created_at,
          updated_at
        `,
      )
      .eq("user_id", userId)
      .order("created_at", {
        ascending: false,
      }),
    supabase
      .from("fuel_transactions")
      .select("truck_id, odometer")
      .eq("user_id", userId)
      .not("odometer", "is", null),
    supabase
      .from("def_transactions")
      .select("truck_id, odometer")
      .eq("user_id", userId)
      .not("odometer", "is", null),
  ]);

  const trucks =
    (trucksData ?? []) as TruckOption[];

  const loads =
    (loadsData ?? []) as LoadOption[];

  const maintenanceRecords =
    (maintenanceData ??
      []) as MaintenanceRecord[];

  const trucksById = new Map(
    trucks.map((truck) => [
      truck.id,
      truck,
    ]),
  );

  const loadsById = new Map(
    loads.map((load) => [
      load.id,
      load,
    ]),
  );

  const currentOdometers =
    new Map<string, number>();

  (
    (fuelOdometerData ??
      []) as OdometerRecord[]
  ).forEach((record) => {
    updateOdometer(
      currentOdometers,
      record,
    );
  });

  (
    (defOdometerData ??
      []) as OdometerRecord[]
  ).forEach((record) => {
    updateOdometer(
      currentOdometers,
      record,
    );
  });

  maintenanceRecords.forEach(
    (record) => {
      updateOdometer(
        currentOdometers,
        {
          truck_id: record.truck_id,
          odometer: record.odometer,
        },
      );
    },
  );

  const today = getDefaultDate();

  const assessments = new Map(
    maintenanceRecords.map((record) => {
      const currentOdometer =
        record.truck_id
          ? currentOdometers.get(
              record.truck_id,
            ) ?? null
          : null;

      return [
        record.id,
        getDueAssessment(
          record,
          currentOdometer,
          today,
        ),
      ];
    }),
  );

  const serviceAlerts =
    maintenanceRecords
      .filter((record) => {
        const tone =
          assessments.get(
            record.id,
          )?.tone;

        return (
          tone === "overdue" ||
          tone === "due_soon"
        );
      })
      .sort((first, second) => {
        const firstTone =
          assessments.get(
            first.id,
          )?.tone;

        const secondTone =
          assessments.get(
            second.id,
          )?.tone;

        if (firstTone === secondTone) {
          return first.work_description.localeCompare(
            second.work_description,
          );
        }

        return firstTone === "overdue"
          ? -1
          : 1;
      });

  const overdueCount =
    serviceAlerts.filter(
      (record) =>
        assessments.get(record.id)
          ?.tone === "overdue",
    ).length;

  const dueSoonCount =
    serviceAlerts.length -
    overdueCount;

  const completedSpend =
    maintenanceRecords
      .filter(
        (record) =>
          record.status === "completed",
      )
      .reduce(
        (total, record) =>
          total +
          Number(record.total_cost),
        0,
      );

  const warrantyCount =
    maintenanceRecords.filter(
      (record) =>
        record.warranty_covered,
    ).length;

  const editingRecord = edit
    ? maintenanceRecords.find(
        (record) =>
          record.id === edit,
      )
    : undefined;

  const hasQueryError = Boolean(
    trucksError ||
      loadsError ||
      maintenanceError ||
      fuelOdometerError ||
      defOdometerError,
  );

  return (
    <main className="min-h-screen pb-16">
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <Link
              href="/"
              className="text-xl font-black tracking-tight text-white"
            >
              Axle
              <span className="text-sky-400">
                ledger
              </span>
            </Link>

            <p className="mt-0.5 text-xs text-slate-500">
              Maintenance operations
            </p>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/expenses"
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-bold text-slate-200 transition hover:border-sky-400 hover:text-white sm:px-4"
            >
              Expenses
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-bold text-slate-200 transition hover:border-sky-400 hover:text-white sm:px-4"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <section>
          <p className="text-sm font-semibold text-sky-400">
            V2 equipment care
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Maintenance
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Schedule service by date or mileage,
            record completed work and cost
            breakdowns, preserve warranty
            coverage, and keep every paid service
            synchronized with exactly one expense.
          </p>
        </section>

        {error ? (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-200"
          >
            {error}
          </div>
        ) : null}

        {success ? (
          <div
            role="status"
            className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-200"
          >
            {success}
          </div>
        ) : null}

        {hasQueryError ? (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-200"
          >
            Axleledger could not retrieve all
            maintenance records or odometer data.
          </div>
        ) : null}

        {trucks.length === 0 ? (
          <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
            Add a truck from{" "}
            <Link
              href="/fuel#truck-entry"
              className="font-bold text-amber-300 underline underline-offset-2"
            >
              Fuel operations
            </Link>{" "}
            before creating structured maintenance.
          </div>
        ) : null}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Maintenance records
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {formatNumber(
                maintenanceRecords.length,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Completed spend
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {formatCurrency(
                completedSpend,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
            <p className="text-sm text-amber-200">
              Due soon
            </p>

            <p className="mt-3 text-2xl font-black text-amber-300">
              {formatNumber(dueSoonCount)}
            </p>
          </article>

          <article className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5">
            <p className="text-sm text-red-200">
              Overdue
            </p>

            <p className="mt-3 text-2xl font-black text-red-300">
              {formatNumber(overdueCount)}
            </p>
          </article>
        </section>

        {serviceAlerts.length > 0 ? (
          <section className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
            <div className="border-b border-slate-800 px-5 py-5 sm:px-6">
              <p className="text-sm font-semibold text-amber-400">
                Service readiness
              </p>

              <h2 className="mt-1 text-2xl font-black text-white">
                Maintenance requiring attention
              </h2>
            </div>

            <div className="divide-y divide-slate-800">
              {serviceAlerts.map(
                (record) => {
                  const assessment =
                    assessments.get(
                      record.id,
                    );

                  const truck =
                    record.truck_id
                      ? trucksById.get(
                          record.truck_id,
                        )
                      : undefined;

                  return (
                    <article
                      key={record.id}
                      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                    >
                      <div>
                        <p className="font-bold text-white">
                          {record.work_description}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {truck
                            ? `Unit ${truck.unit_number}`
                            : "Unassigned truck"}
                          {" · "}
                          {assessment?.detail}
                        </p>
                      </div>

                      <span
                        className={`self-start rounded-full border px-3 py-1 text-xs font-bold ${dueStyles[
                          assessment?.tone ??
                            "scheduled"
                        ]}`}
                      >
                        {assessment?.label}
                      </span>
                    </article>
                  );
                },
              )}
            </div>
          </section>
        ) : null}

        <section className="mt-8 grid items-start gap-6 xl:grid-cols-[0.95fr_1.35fr]">
          <MaintenanceForm
            key={
              editingRecord?.id ??
              saved ??
              "new-maintenance"
            }
            editingRecord={editingRecord}
            trucks={trucks}
            loads={loads}
            defaultDate={today}
            resetKey={saved}
            editRequested={Boolean(edit)}
          />

          <article className="self-start overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
            <div className="border-b border-slate-800 px-5 py-5 sm:px-6">
              <p className="text-sm font-semibold text-sky-400">
                Service ledger
              </p>

              <h2 className="mt-1 text-2xl font-black text-white">
                Maintenance history
              </h2>

              <p className="mt-2 text-xs text-slate-500">
                {warrantyCount} record
                {warrantyCount === 1
                  ? ""
                  : "s"}{" "}
                include warranty coverage.
              </p>
            </div>

            {maintenanceRecords.length ===
            0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-xl font-black text-slate-400">
                  0
                </div>

                <p className="mt-4 font-bold text-white">
                  No maintenance recorded
                </p>

                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Schedule your first service or
                  record completed work using the
                  maintenance form.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {maintenanceRecords.map(
                  (record) => {
                    const truck =
                      record.truck_id
                        ? trucksById.get(
                            record.truck_id,
                          )
                        : undefined;

                    const load =
                      record.load_id
                        ? loadsById.get(
                            record.load_id,
                          )
                        : undefined;

                    const assessment =
                      assessments.get(
                        record.id,
                      ) ?? {
                        tone: "completed" as const,
                        label: "Completed",
                        detail: "",
                      };

                    const currentOdometer =
                      record.truck_id
                        ? currentOdometers.get(
                            record.truck_id,
                          ) ?? null
                        : null;

                    return (
                      <section
                        key={record.id}
                        className="p-5 sm:p-6"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="text-lg font-black text-white">
                                {
                                  record.work_description
                                }
                              </h3>

                              <span
                                className={`rounded-full border px-2.5 py-1 text-xs font-bold ${dueStyles[assessment.tone]}`}
                              >
                                {
                                  assessment.label
                                }
                              </span>

                              {record.is_legacy ? (
                                <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300">
                                  V1 legacy
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-2 text-sm font-semibold text-slate-300">
                              {truck
                                ? `Unit ${truck.unit_number} · `
                                : "Unassigned truck · "}
                              {
                                categoryLabels[
                                  record
                                    .service_category
                                ]
                              }
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {assessment.detail ||
                                "No next-service target"}
                              {currentOdometer !==
                              null
                                ? ` · Current odometer ${formatNumber(
                                    currentOdometer,
                                  )}`
                                : ""}
                            </p>

                            {record.vendor ? (
                              <p className="mt-2 text-xs text-slate-500">
                                Vendor:{" "}
                                <span className="font-semibold text-slate-300">
                                  {record.vendor}
                                </span>
                              </p>
                            ) : null}

                            {load ? (
                              <p className="mt-2 text-xs text-slate-500">
                                Related load:{" "}
                                <span className="font-semibold text-slate-300">
                                  {load.load_number}
                                </span>
                              </p>
                            ) : null}
                          </div>

                          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                            <p className="text-lg font-black text-white">
                              {record.status ===
                              "completed"
                                ? formatCurrency(
                                    record.total_cost,
                                  )
                                : "Scheduled"}
                            </p>

                            <div className="flex items-center gap-2">
                              <Link
                                href={`/maintenance?edit=${record.id}#maintenance-form`}
                                className="rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-bold text-sky-300 transition hover:border-sky-400/50 hover:bg-sky-400/20"
                              >
                                Edit
                              </Link>

                              <DeleteMaintenanceForm
                                recordId={
                                  record.id
                                }
                                description={`maintenance record for ${record.work_description}`}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-xl bg-slate-950/70 p-4">
                            <p className="text-xs text-slate-500">
                              Scheduled
                            </p>

                            <p className="mt-1 text-sm font-bold text-white">
                              {formatDate(
                                record.scheduled_date,
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {record.scheduled_odometer ===
                              null
                                ? "No mileage target"
                                : `${formatNumber(
                                    record.scheduled_odometer,
                                  )} miles`}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-950/70 p-4">
                            <p className="text-xs text-slate-500">
                              Completed
                            </p>

                            <p className="mt-1 text-sm font-bold text-white">
                              {formatDate(
                                record.completed_date,
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {record.odometer ===
                              null
                                ? "No odometer"
                                : `${formatNumber(
                                    record.odometer,
                                  )} miles`}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-950/70 p-4">
                            <p className="text-xs text-slate-500">
                              Next date
                            </p>

                            <p className="mt-1 text-sm font-bold text-white">
                              {formatDate(
                                record.next_service_date,
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-950/70 p-4">
                            <p className="text-xs text-slate-500">
                              Next odometer
                            </p>

                            <p className="mt-1 text-sm font-bold text-white">
                              {record.next_service_odometer ===
                              null
                                ? "Not set"
                                : `${formatNumber(
                                    record.next_service_odometer,
                                  )} miles`}
                            </p>
                          </div>
                        </div>

                        {record.status ===
                        "completed" ? (
                          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {[
                              [
                                "Parts",
                                record.parts_cost,
                              ],
                              [
                                "Labor",
                                record.labor_cost,
                              ],
                              [
                                "Tax",
                                record.tax_cost,
                              ],
                              [
                                "Other",
                                record.other_cost,
                              ],
                            ].map(
                              ([label, value]) => (
                                <div
                                  key={
                                    label as string
                                  }
                                  className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3"
                                >
                                  <p className="text-xs text-slate-500">
                                    {label}
                                  </p>

                                  <p className="mt-1 font-bold text-white">
                                    {formatCurrency(
                                      Number(value),
                                    )}
                                  </p>
                                </div>
                              ),
                            )}
                          </div>
                        ) : null}

                        {record.warranty_covered ? (
                          <div className="mt-4 rounded-xl border border-violet-400/20 bg-violet-400/10 px-4 py-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-violet-300">
                              Warranty coverage
                            </p>

                            <p className="mt-2 text-sm leading-6 text-violet-100">
                              {record.warranty_provider ??
                                "Provider not recorded"}
                              {record.warranty_claim_number
                                ? ` · Claim ${record.warranty_claim_number}`
                                : ""}
                            </p>

                            <p className="mt-1 text-xs text-violet-200/70">
                              {record.warranty_expiration_date
                                ? `Expires ${formatDate(
                                    record.warranty_expiration_date,
                                  )}`
                                : "No expiration date"}
                              {record.warranty_expiration_odometer !==
                              null
                                ? ` · ${formatNumber(
                                    record.warranty_expiration_odometer,
                                  )} miles`
                                : ""}
                            </p>
                          </div>
                        ) : null}

                        {record.is_legacy ? (
                          <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs leading-5 text-slate-500">
                            Backfilled from a V1
                            maintenance expense.
                            The original cost is
                            preserved as “Other”
                            because parts and labor
                            detail were unavailable.
                          </p>
                        ) : null}

                        {record.notes ? (
                          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Notes
                            </p>

                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                              {record.notes}
                            </p>
                          </div>
                        ) : null}
                      </section>
                    );
                  },
                )}
              </div>
            )}
          </article>
        </section>

        <div className="mt-8 rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3 text-xs leading-5 text-sky-100/80">
          Maintenance expenses remain in the
          central expense ledger and are counted
          once. Scheduled maintenance has no
          financial impact until it is completed.
          Due-soon thresholds are 14 days or
          1,000 miles.
        </div>
      </div>
    </main>
  );
}
