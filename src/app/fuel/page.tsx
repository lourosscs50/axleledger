import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { DefForm } from "./def-form";
import { DeleteRecordForm } from "./delete-record-form";
import { FuelForm } from "./fuel-form";
import { TruckForm } from "./truck-form";
import type {
  LoadOption,
  TruckOption,
} from "./types";

export const metadata: Metadata = {
  title: "Fuel Operations",
  description:
    "Track trucks, diesel purchases, discounts, and DEF transactions.",
};

type FuelTransaction = {
  id: string;
  expense_id: string;
  truck_id: string | null;
  load_id: string | null;
  transaction_date: string;
  transaction_time: string | null;
  odometer: number | null;
  gallons: number | null;
  pump_price_per_gallon: number | null;
  discount_per_gallon: number | null;
  net_price_per_gallon: number | null;
  total_amount: number;
  network: string | null;
  location_name: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  is_legacy: boolean;
  created_at: string;
};

type DefTransaction = {
  id: string;
  expense_id: string;
  truck_id: string;
  load_id: string | null;
  transaction_date: string;
  transaction_time: string | null;
  odometer: number | null;
  gallons: number;
  price_per_gallon: number;
  total_amount: number;
  network: string | null;
  location_name: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  created_at: string;
};

type FuelPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    saved?: string;
    editFuel?: string;
    editDef?: string;
  }>;
};

const currencyFormatter =
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

const numberFormatter =
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  });

const dateFormatter =
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

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

function formatDate(value: string) {
  return dateFormatter.format(
    new Date(`${value}T00:00:00Z`),
  );
}

function getDefaultDate() {
  const formatter =
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/Chicago",
    });

  const parts =
    formatter.formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ]),
  ) as Record<string, string>;

  return `${values.year}-${values.month}-${values.day}`;
}

function getLocationLabel(
  transaction: {
    location_name: string | null;
    network: string | null;
    city: string | null;
    state: string | null;
  },
) {
  const primary =
    transaction.location_name ??
    transaction.network ??
    "Fuel purchase";

  const cityState = [
    transaction.city,
    transaction.state,
  ]
    .filter(Boolean)
    .join(", ");

  return cityState
    ? `${primary} · ${cityState}`
    : primary;
}

export default async function FuelPage({
  searchParams,
}: FuelPageProps) {
  const {
    error,
    success,
    saved,
    editFuel,
    editDef,
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
      data: fuelData,
      error: fuelError,
    },
    {
      data: defData,
      error: defError,
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
      .from("fuel_transactions")
      .select(
        `
          id,
          expense_id,
          truck_id,
          load_id,
          transaction_date,
          transaction_time,
          odometer,
          gallons,
          pump_price_per_gallon,
          discount_per_gallon,
          net_price_per_gallon,
          total_amount,
          network,
          location_name,
          city,
          state,
          notes,
          is_legacy,
          created_at
        `,
      )
      .eq("user_id", userId)
      .order("transaction_date", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      }),
    supabase
      .from("def_transactions")
      .select(
        `
          id,
          expense_id,
          truck_id,
          load_id,
          transaction_date,
          transaction_time,
          odometer,
          gallons,
          price_per_gallon,
          total_amount,
          network,
          location_name,
          city,
          state,
          notes,
          created_at
        `,
      )
      .eq("user_id", userId)
      .order("transaction_date", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      }),
  ]);

  const trucks =
    (trucksData ?? []) as TruckOption[];

  const loads =
    (loadsData ?? []) as LoadOption[];

  const fuelTransactions =
    (fuelData ?? []) as FuelTransaction[];

  const defTransactions =
    (defData ?? []) as DefTransaction[];

  const editingFuelTransaction =
    editFuel
      ? fuelTransactions.find(
          (transaction) =>
            transaction.id === editFuel &&
            !transaction.is_legacy,
        )
      : undefined;

  const editingDefTransaction =
    editDef
      ? defTransactions.find(
          (transaction) =>
            transaction.id === editDef,
        )
      : undefined;

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

  const dieselGallons =
    fuelTransactions.reduce(
      (total, transaction) =>
        total +
        Number(
          transaction.gallons ?? 0,
        ),
      0,
    );

  const dieselSpend =
    fuelTransactions.reduce(
      (total, transaction) =>
        total +
        Number(
          transaction.total_amount,
        ),
      0,
    );

  const defSpend =
    defTransactions.reduce(
      (total, transaction) =>
        total +
        Number(
          transaction.total_amount,
        ),
      0,
    );

  const hasQueryError = Boolean(
    trucksError ||
      loadsError ||
      fuelError ||
      defError,
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
              Fuel and equipment operations
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
            V2 operational detail
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Fuel operations
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Record diesel and DEF with truck,
            load, odometer, gallons, pricing,
            discount, and location detail.
            Every transaction creates exactly
            one linked expense, keeping the
            expense ledger as the financial
            source of truth.
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
            fuel-operation records.
          </div>
        ) : null}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Trucks
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {formatNumber(trucks.length)}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Diesel gallons
            </p>

            <p className="mt-3 text-2xl font-black text-amber-400">
              {formatNumber(dieselGallons)}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Diesel spend
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {formatCurrency(dieselSpend)}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              DEF spend
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {formatCurrency(defSpend)}
            </p>
          </article>
        </section>

        <section className="mt-8 grid items-start gap-6 xl:grid-cols-3">
          <TruckForm resetKey={saved} />

          <FuelForm
            trucks={trucks}
            loads={loads}
            defaultDate={getDefaultDate()}
            resetKey={saved}
            editingTransaction={
              editingFuelTransaction
            }
            editRequested={Boolean(
              editFuel,
            )}
          />

          <DefForm
            trucks={trucks}
            loads={loads}
            defaultDate={getDefaultDate()}
            resetKey={saved}
            editingTransaction={
              editingDefTransaction
            }
            editRequested={Boolean(
              editDef,
            )}
          />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
          <div className="border-b border-slate-800 px-5 py-5 sm:px-6">
            <p className="text-sm font-semibold text-sky-400">
              Equipment
            </p>

            <h2 className="mt-1 text-2xl font-black text-white">
              Truck records
            </h2>
          </div>

          {trucks.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-bold text-white">
                No trucks recorded
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Add a truck to unlock
                structured diesel and DEF
                tracking.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {trucks.map((truck) => (
                <article
                  key={truck.id}
                  className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-black text-white">
                        Unit {truck.unit_number}
                      </h3>

                      <span
                        className={
                          truck.is_active
                            ? "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-300"
                            : "rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-400"
                        }
                      >
                        {truck.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-400">
                      {truck.year
                        ? `${truck.year} `
                        : ""}
                      {truck.make} {truck.model}
                    </p>
                  </div>

                  <DeleteRecordForm
                    kind="truck"
                    recordId={truck.id}
                    description={`unit ${truck.unit_number}`}
                  />
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 grid items-start gap-6 xl:grid-cols-2">
          <article className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
            <div className="border-b border-slate-800 px-5 py-5 sm:px-6">
              <p className="text-sm font-semibold text-amber-400">
                Diesel ledger
              </p>

              <h2 className="mt-1 text-2xl font-black text-white">
                Diesel history
              </h2>
            </div>

            {fuelTransactions.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="font-bold text-white">
                  No diesel transactions
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Add your first purchase using
                  the diesel form.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {fuelTransactions.map(
                  (transaction) => {
                    const truck =
                      transaction.truck_id
                        ? trucksById.get(
                            transaction.truck_id,
                          )
                        : undefined;

                    const load =
                      transaction.load_id
                        ? loadsById.get(
                            transaction.load_id,
                          )
                        : undefined;

                    return (
                      <article
                        key={transaction.id}
                        className="p-5 sm:p-6"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="font-black text-white">
                                {getLocationLabel(
                                  transaction,
                                )}
                              </h3>

                              {transaction.is_legacy ? (
                                <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300">
                                  V1 legacy
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-2 text-sm text-slate-400">
                              {formatDate(
                                transaction.transaction_date,
                              )}
                              {truck
                                ? ` · Unit ${truck.unit_number}`
                                : ""}
                            </p>
                          </div>

                          <p className="shrink-0 text-lg font-black text-white">
                            {formatCurrency(
                              transaction.total_amount,
                            )}
                          </p>
                        </div>

                        {transaction.is_legacy ? (
                          <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs leading-5 text-slate-500">
                            Backfilled from a
                            V1 fuel expense.
                            Gallons, odometer,
                            and pricing detail
                            were not available.
                          </p>
                        ) : (
                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl bg-slate-950/70 p-3">
                              <p className="text-xs text-slate-500">
                                Gallons
                              </p>

                              <p className="mt-1 font-bold text-white">
                                {formatNumber(
                                  transaction.gallons,
                                )}
                              </p>
                            </div>

                            <div className="rounded-xl bg-slate-950/70 p-3">
                              <p className="text-xs text-slate-500">
                                Net price
                              </p>

                              <p className="mt-1 font-bold text-white">
                                {transaction.net_price_per_gallon ===
                                null
                                  ? "—"
                                  : formatCurrency(
                                      transaction.net_price_per_gallon,
                                    )}
                              </p>
                            </div>

                            <div className="rounded-xl bg-slate-950/70 p-3">
                              <p className="text-xs text-slate-500">
                                Odometer
                              </p>

                              <p className="mt-1 font-bold text-white">
                                {formatNumber(
                                  transaction.odometer,
                                )}
                              </p>
                            </div>
                          </div>
                        )}

                        {load ? (
                          <p className="mt-4 text-sm text-slate-400">
                            Load{" "}
                            <span className="font-bold text-white">
                              {load.load_number}
                            </span>
                          </p>
                        ) : null}

                        <div className="mt-4 flex justify-end gap-2">
                          {!transaction.is_legacy ? (
                            <Link
                              href={`/fuel?editFuel=${transaction.id}#fuel-entry`}
                              className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-300 transition hover:border-amber-400/50 hover:bg-amber-400/20"
                            >
                              Edit
                            </Link>
                          ) : null}

                          <DeleteRecordForm
                            kind="fuel"
                            recordId={
                              transaction.id
                            }
                            description={`diesel transaction dated ${formatDate(
                              transaction.transaction_date,
                            )}`}
                          />
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            )}
          </article>

          <article className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
            <div className="border-b border-slate-800 px-5 py-5 sm:px-6">
              <p className="text-sm font-semibold text-sky-400">
                DEF ledger
              </p>

              <h2 className="mt-1 text-2xl font-black text-white">
                DEF history
              </h2>
            </div>

            {defTransactions.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="font-bold text-white">
                  No DEF transactions
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Add your first purchase using
                  the DEF form.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {defTransactions.map(
                  (transaction) => {
                    const truck =
                      trucksById.get(
                        transaction.truck_id,
                      );

                    const load =
                      transaction.load_id
                        ? loadsById.get(
                            transaction.load_id,
                          )
                        : undefined;

                    return (
                      <article
                        key={transaction.id}
                        className="p-5 sm:p-6"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="font-black text-white">
                              {getLocationLabel(
                                transaction,
                              )}
                            </h3>

                            <p className="mt-2 text-sm text-slate-400">
                              {formatDate(
                                transaction.transaction_date,
                              )}
                              {truck
                                ? ` · Unit ${truck.unit_number}`
                                : ""}
                            </p>
                          </div>

                          <p className="shrink-0 text-lg font-black text-white">
                            {formatCurrency(
                              transaction.total_amount,
                            )}
                          </p>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl bg-slate-950/70 p-3">
                            <p className="text-xs text-slate-500">
                              Gallons
                            </p>

                            <p className="mt-1 font-bold text-white">
                              {formatNumber(
                                transaction.gallons,
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-950/70 p-3">
                            <p className="text-xs text-slate-500">
                              Price
                            </p>

                            <p className="mt-1 font-bold text-white">
                              {formatCurrency(
                                transaction.price_per_gallon,
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-950/70 p-3">
                            <p className="text-xs text-slate-500">
                              Odometer
                            </p>

                            <p className="mt-1 font-bold text-white">
                              {formatNumber(
                                transaction.odometer,
                              )}
                            </p>
                          </div>
                        </div>

                        {load ? (
                          <p className="mt-4 text-sm text-slate-400">
                            Load{" "}
                            <span className="font-bold text-white">
                              {load.load_number}
                            </span>
                          </p>
                        ) : null}

                        <div className="mt-4 flex justify-end gap-2">
                          <Link
                            href={`/fuel?editDef=${transaction.id}#def-entry`}
                            className="rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-bold text-sky-300 transition hover:border-sky-400/50 hover:bg-sky-400/20"
                          >
                            Edit
                          </Link>

                          <DeleteRecordForm
                            kind="def"
                            recordId={
                              transaction.id
                            }
                            description={`DEF transaction dated ${formatDate(
                              transaction.transaction_date,
                            )}`}
                          />
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            )}
          </article>
        </section>

        <div className="mt-8 rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3 text-xs leading-5 text-sky-100/80">
          Structured diesel and DEF records are
          operational detail. Their linked
          expense records are counted once in
          dashboard totals and cannot be edited
          or deleted independently.
        </div>
      </div>
    </main>
  );
}
