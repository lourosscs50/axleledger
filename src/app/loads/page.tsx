import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { LoadForm } from "./load-form";
import { DeleteLoadForm } from "./delete-load-form";

export const metadata: Metadata = {
  title: "Loads",
  description:
    "Add and manage Axleledger load records.",
};

type LoadStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled";

type LoadRecord = {
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
  created_at: string;
};

type LoadsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    edit?: string;
    saved?: string;
  }>;
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

const statusDetails: Record<
  LoadStatus,
  {
    label: string;
    className: string;
  }
> = {
  planned: {
    label: "Planned",
    className:
      "border-slate-700 bg-slate-800 text-slate-300",
  },
  in_progress: {
    label: "In progress",
    className:
      "border-amber-400/20 bg-amber-400/10 text-amber-300",
  },
  completed: {
    label: "Completed",
    className:
      "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "border-red-400/20 bg-red-400/10 text-red-300",
  },
};

function formatCurrency(value: number) {
  return currencyFormatter.format(
    Number(value),
  );
}

function formatNumber(value: number) {
  return numberFormatter.format(
    Number(value),
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return dateFormatter.format(
    new Date(`${value}T00:00:00Z`),
  );
}

export default async function LoadsPage({
  searchParams,
}: LoadsPageProps) {
  const {
    error,
    success,
    edit,
    saved,
  } = await searchParams;

  const supabase = await createClient();

  const { data: claimsData } =
    await supabase.auth.getClaims();

  if (!claimsData?.claims) {
    redirect("/login");
  }

  const {
    data,
    error: loadsQueryError,
  } = await supabase
    .from("loads")
    .select(
      `
        id,
        load_number,
        carrier_or_broker,
        origin_city,
        origin_state,
        destination_city,
        destination_state,
        pickup_date,
        delivery_date,
        gross_revenue,
        loaded_miles,
        deadhead_miles,
        status,
        notes,
        created_at
      `,
    )
    .order("pickup_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  const loads = (data ?? []) as LoadRecord[];

  const editingLoad = edit
    ? loads.find((load) => load.id === edit)
    : undefined;

  const totalRevenue = loads
    .filter(
      (load) => load.status === "completed",
    )
    .reduce(
      (total, load) =>
        total + Number(load.gross_revenue),
      0,
    );

  const totalLoadedMiles = loads.reduce(
    (total, load) =>
      total + Number(load.loaded_miles),
    0,
  );

  const totalDeadheadMiles = loads.reduce(
    (total, load) =>
      total + Number(load.deadhead_miles),
    0,
  );

  return (
    <main className="min-h-screen pb-16">
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
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
              Load management
            </p>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:border-sky-400 hover:text-white"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <section>
          <p className="text-sm font-semibold text-sky-400">
            Revenue and mileage
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Loads
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Add each load once and Axleledger
            will use the record to calculate
            revenue, loaded miles, deadhead
            miles, and operating performance.
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

        {loadsQueryError ? (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-200"
          >
            Axleledger could not retrieve your
            loads.
          </div>
        ) : null}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Recorded loads
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {formatNumber(loads.length)}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Completed revenue
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {formatCurrency(totalRevenue)}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Loaded miles
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {formatNumber(totalLoadedMiles)}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Deadhead miles
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {formatNumber(totalDeadheadMiles)}
            </p>
          </article>
        </section>

        <section className="mt-8 grid items-start gap-6 xl:grid-cols-[0.9fr_1.4fr]">
          <LoadForm
            editingLoad={editingLoad}
            resetKey={saved}
            editRequested={Boolean(edit)}
          />

          <article className="self-start overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
            <div className="border-b border-slate-800 px-5 py-5 sm:px-6">
              <p className="text-sm font-semibold text-sky-400">
                Your records
              </p>

              <h2 className="mt-1 text-2xl font-black text-white">
                Load history
              </h2>
            </div>

            {loads.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-xl font-black text-slate-400">
                  0
                </div>

                <p className="mt-4 font-bold text-white">
                  No loads recorded
                </p>

                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Add your first load using the
                  form. It will appear here
                  immediately.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {loads.map((load) => {
                  const status =
                    statusDetails[load.status];

                  const totalMiles =
                    Number(load.loaded_miles) +
                    Number(load.deadhead_miles);

                  return (
                    <section
                      key={load.id}
                      className="p-5 sm:p-6"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-black text-white">
                              {load.load_number}
                            </h3>

                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-bold ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </div>

                          <p className="mt-2 text-sm font-semibold text-slate-300">
                            {load.origin_city},{" "}
                            {load.origin_state}
                            {" → "}
                            {load.destination_city},{" "}
                            {load.destination_state}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Pickup{" "}
                            {formatDate(
                              load.pickup_date,
                            )}
                            {" · "}
                            Delivery{" "}
                            {formatDate(
                              load.delivery_date,
                            )}
                          </p>

                          {load.carrier_or_broker ? (
                            <p className="mt-2 text-xs text-slate-500">
                              Carrier/Broker:{" "}
                              {
                                load.carrier_or_broker
                              }
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                          <p className="text-lg font-black text-white">
                            {formatCurrency(
                              load.gross_revenue,
                            )}
                          </p>

                          <div className="flex items-center gap-2">
                            <Link
                              href={`/loads?edit=${load.id}#load-form`}
                              className="rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-bold text-sky-300 transition hover:border-sky-400/50 hover:bg-sky-400/20"
                            >
                              Edit
                            </Link>

                            <DeleteLoadForm
                              loadId={load.id}
                              loadNumber={
                                load.load_number
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl bg-slate-950/70 p-4">
                          <p className="text-xs text-slate-500">
                            Loaded miles
                          </p>

                          <p className="mt-1 font-bold text-white">
                            {formatNumber(
                              load.loaded_miles,
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-950/70 p-4">
                          <p className="text-xs text-slate-500">
                            Deadhead miles
                          </p>

                          <p className="mt-1 font-bold text-white">
                            {formatNumber(
                              load.deadhead_miles,
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-950/70 p-4">
                          <p className="text-xs text-slate-500">
                            Total miles
                          </p>

                          <p className="mt-1 font-bold text-white">
                            {formatNumber(
                              totalMiles,
                            )}
                          </p>
                        </div>
                      </div>

                      {load.notes ? (
                        <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm leading-6 text-slate-400">
                          {load.notes}
                        </p>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}