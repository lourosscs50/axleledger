import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type LoadRecord = {
  id: string;
  loadNumber: string;
  revenue: number;
  loadedMiles: number;
  deadheadMiles: number;
  status:
    | "planned"
    | "in-progress"
    | "completed"
    | "cancelled";
  completedAt: string | null;
};

type ExpenseCategory =
  | "Fuel"
  | "Maintenance"
  | "Tolls"
  | "Parking"
  | "Scales"
  | "Food"
  | "Supplies"
  | "Other";

type ExpenseRecord = {
  id: string;
  category: ExpenseCategory;
  amount: number;
  occurredAt: string;
  vendor: string | null;
};

type DatabaseLoadStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled";

type DatabaseLoadRecord = {
  id: string;
  load_number: string;
  gross_revenue: number;
  loaded_miles: number;
  deadhead_miles: number;
  status: DatabaseLoadStatus;
  delivery_date: string | null;
  created_at: string;
};

type DatabaseExpenseCategory =
  | "fuel"
  | "maintenance"
  | "tolls"
  | "parking"
  | "scales"
  | "food"
  | "supplies"
  | "other";

type DatabaseExpenseRecord = {
  id: string;
  category: DatabaseExpenseCategory;
  amount: number;
  expense_date: string;
  vendor: string | null;
};

type SettlementRecord = {
  id: string;
  grossPay: number;
  deductions: number;
  reimbursements: number;
  netDeposit: number;
  settlementDate: string;
};

type FixedCostRecord = {
  id: string;
  name: string;
  amount: number;
  frequency: "weekly" | "monthly";
  effectiveDate: string;
};

type ActivityRecord = {
  id: string;
  title: string;
  description: string;
  amount: number;
  occurredAt: string;
  type: "income" | "expense";
};

type StatusTone = "neutral" | "good" | "warning" | "bad";

type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  statusLabel: string;
  tone: StatusTone;
};

/*
  Settlements and fixed costs remain empty until
  those database features are implemented.
*/
const settlements: SettlementRecord[] = [];
const fixedCosts: FixedCostRecord[] = [];

const navigationItems = [
  {
    label: "Dashboard",
    href: "/",
  },
  {
    label: "Loads",
    href: "/loads",
  },
  {
    label: "Expenses",
    href: "/expenses",
  },
  {
    label: "Settlements",
    href: null,
  },
] as const;

const quickActions = [
  {
    label: "Add load",
    description:
      "Record revenue, route, and miles",
    symbol: "+",
    href: "/loads#load-form",
  },
  {
    label: "Add expense",
    description:
      "Record fuel, tolls, maintenance, and more",
    symbol: "−",
    href: "/expenses#expense-form",
  },
  {
    label: "Add settlement",
    description:
      "Record deductions and your actual deposit",
    symbol: "$",
    href: null,
  },
  {
    label: "Manage fixed costs",
    description:
      "Set truck payment, insurance, and recurring costs",
    symbol: "=",
    href: null,
  },
] as const;

const expenseCategoryLabels: Record<
  DatabaseExpenseCategory,
  ExpenseCategory
> = {
  fuel: "Fuel",
  maintenance: "Maintenance",
  tolls: "Tolls",
  parking: "Parking",
  scales: "Scales",
  food: "Food",
  supplies: "Supplies",
  other: "Other",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const numberFormatter =
  new Intl.NumberFormat("en-US");

const activityDateFormatter =
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatActivityDate(
  value: string | null,
) {
  if (!value) {
    return "Date unavailable";
  }

  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00Z`);

  return activityDateFormatter.format(
    date,
  );
}

function formatRate(value: number | null) {
  if (value === null) {
    return "—";
  }

  return formatCurrency(value);
}

function sumValues<T>(records: T[], selector: (record: T) => number) {
  return records.reduce((total, record) => total + selector(record), 0);
}

function getProfitTone(
  value: number,
  hasFinancialData: boolean,
): StatusTone {
  if (!hasFinancialData) {
    return "neutral";
  }

  if (value > 0) {
    return "good";
  }

  if (value === 0) {
    return "warning";
  }

  return "bad";
}

function getProfitStatus(
  value: number,
  hasFinancialData: boolean,
) {
  if (!hasFinancialData) {
    return "No data";
  }

  if (value > 0) {
    return "Good standing";
  }

  if (value === 0) {
    return "Needs attention";
  }

  return "Operating at a loss";
}

function getProfitPerMileTone(
  value: number | null,
): StatusTone {
  if (value === null) {
    return "neutral";
  }

  if (value >= 0.5) {
    return "good";
  }

  if (value > 0) {
    return "warning";
  }

  return "bad";
}

function getProfitPerMileStatus(
  value: number | null,
) {
  if (value === null) {
    return "No mileage data";
  }

  if (value >= 0.5) {
    return "Good standing";
  }

  if (value > 0) {
    return "Needs improvement";
  }

  return "Losing money per mile";
}

function getExpenseTone(
  expenseTotal: number,
  grossRevenue: number,
): StatusTone {
  if (expenseTotal === 0 && grossRevenue === 0) {
    return "neutral";
  }

  if (grossRevenue === 0 && expenseTotal > 0) {
    return "bad";
  }

  const expenseRatio = expenseTotal / grossRevenue;

  if (expenseRatio <= 0.6) {
    return "good";
  }

  if (expenseRatio <= 0.8) {
    return "warning";
  }

  return "bad";
}

function getExpenseStatus(
  expenseTotal: number,
  grossRevenue: number,
) {
  if (expenseTotal === 0 && grossRevenue === 0) {
    return "No data";
  }

  if (grossRevenue === 0 && expenseTotal > 0) {
    return "Costs without revenue";
  }

  const expenseRatio = expenseTotal / grossRevenue;

  if (expenseRatio <= 0.6) {
    return "Good standing";
  }

  if (expenseRatio <= 0.8) {
    return "Needs attention";
  }

  return "Expenses too high";
}

const toneStyles: Record<
  StatusTone,
  {
    badge: string;
    value: string;
    dot: string;
  }
> = {
  neutral: {
    badge:
      "border-slate-700 bg-slate-800/80 text-slate-300",
    value: "text-white",
    dot: "bg-slate-500",
  },
  good: {
    badge:
      "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    value: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  warning: {
    badge:
      "border-amber-400/20 bg-amber-400/10 text-amber-300",
    value: "text-amber-400",
    dot: "bg-amber-400",
  },
  bad: {
    badge:
      "border-red-400/20 bg-red-400/10 text-red-300",
    value: "text-red-400",
    dot: "bg-red-400",
  },
};

function MetricCard({
  metric,
}: {
  metric: DashboardMetric;
}) {
  const styles = toneStyles[metric.tone];

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/10">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-400">
          {metric.label}
        </p>

        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${styles.badge}`}
        >
          {metric.statusLabel}
        </span>
      </div>

      <p
        className={`mt-4 text-2xl font-black tracking-tight ${styles.value}`}
      >
        {metric.value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {metric.detail}
      </p>
    </article>
  );
}

export default async function Home() {
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
      data: loadsData,
      error: loadsQueryError,
    },
    {
      data: expensesData,
      error: expensesQueryError,
    },
  ] = await Promise.all([
    supabase
      .from("loads")
      .select(
        `
          id,
          load_number,
          gross_revenue,
          loaded_miles,
          deadhead_miles,
          status,
          delivery_date,
          created_at
        `,
      )
      .eq("user_id", userId)
      .order("created_at", {
        ascending: false,
      }),
    supabase
      .from("expenses")
      .select(
        `
          id,
          category,
          amount,
          expense_date,
          vendor
        `,
      )
      .eq("user_id", userId)
      .order("expense_date", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      }),
  ]);

  if (loadsQueryError) {
    console.error(
      "Unable to retrieve dashboard loads:",
      loadsQueryError,
    );
  }

  if (expensesQueryError) {
    console.error(
      "Unable to retrieve dashboard expenses:",
      expensesQueryError,
    );
  }

  const loads = (
    (loadsData ?? []) as DatabaseLoadRecord[]
  ).map(
    (load): LoadRecord => ({
      id: load.id,
      loadNumber: load.load_number,
      revenue: Number(
        load.gross_revenue,
      ),
      loadedMiles: Number(
        load.loaded_miles,
      ),
      deadheadMiles: Number(
        load.deadhead_miles,
      ),
      status:
        load.status === "in_progress"
          ? "in-progress"
          : load.status,
      completedAt:
        load.delivery_date ??
        load.created_at,
    }),
  );

  const expenses = (
    (expensesData ??
      []) as DatabaseExpenseRecord[]
  ).map(
    (expense): ExpenseRecord => ({
      id: expense.id,
      category:
        expenseCategoryLabels[
          expense.category
        ],
      amount: Number(expense.amount),
      occurredAt: expense.expense_date,
      vendor: expense.vendor,
    }),
  );

  const activityEntries = [
    ...loads
      .filter(
        (load) =>
          load.status === "completed",
      )
      .map((load) => ({
        id: `load-${load.id}`,
        title: load.loadNumber,
        description: "Completed load",
        amount: load.revenue,
        occurredAt: formatActivityDate(
          load.completedAt,
        ),
        type: "income" as const,
        sortDate:
          load.completedAt ?? "",
      })),
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      title:
        expense.vendor ??
        `${expense.category} expense`,
      description: expense.category,
      amount: expense.amount,
      occurredAt: formatActivityDate(
        expense.occurredAt,
      ),
      type: "expense" as const,
      sortDate: expense.occurredAt,
    })),
  ];

  const recentActivity: ActivityRecord[] =
    activityEntries
      .sort((first, second) =>
        second.sortDate.localeCompare(
          first.sortDate,
        ),
      )
      .slice(0, 8)
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        description: entry.description,
        amount: entry.amount,
        occurredAt: entry.occurredAt,
        type: entry.type,
      }));

  const hasDashboardQueryError =
    Boolean(
      loadsQueryError ||
        expensesQueryError,
    );

  const completedLoads = loads.filter(
    (load) => load.status === "completed",
  );

  const grossRevenue = sumValues(
    completedLoads,
    (load) => load.revenue,
  );

  const loadedMiles = sumValues(
    completedLoads,
    (load) => load.loadedMiles,
  );

  const deadheadMiles = sumValues(
    completedLoads,
    (load) => load.deadheadMiles,
  );

  const totalMiles = loadedMiles + deadheadMiles;

  const directExpenses = sumValues(
    expenses,
    (expense) => expense.amount,
  );

  const settlementDeductions = sumValues(
    settlements,
    (settlement) => settlement.deductions,
  );

  const recurringCosts = sumValues(
    fixedCosts,
    (fixedCost) => fixedCost.amount,
  );

  const totalExpenses =
    directExpenses +
    settlementDeductions +
    recurringCosts;

  const netProfit = grossRevenue - totalExpenses;

  const profitPerMile =
    totalMiles > 0 ? netProfit / totalMiles : null;

  const deadheadRate =
    totalMiles > 0
      ? (deadheadMiles / totalMiles) * 100
      : null;

  const averageRevenuePerLoad =
    completedLoads.length > 0
      ? grossRevenue / completedLoads.length
      : null;

  const fuelExpenses = sumValues(
    expenses.filter(
      (expense) => expense.category === "Fuel",
    ),
    (expense) => expense.amount,
  );

  const fuelCostPerMile =
    totalMiles > 0 && fuelExpenses > 0
      ? fuelExpenses / totalMiles
      : null;

  const estimatedTaxReserve =
    netProfit > 0 ? netProfit * 0.25 : null;

  const hasFinancialData =
    loads.length > 0 ||
    expenses.length > 0 ||
    settlements.length > 0 ||
    fixedCosts.length > 0;

  const hasBreakEvenData = totalExpenses > 0;

  const breakEvenProgress =
    hasBreakEvenData
      ? Math.min(
          (grossRevenue / totalExpenses) * 100,
          100,
        )
      : 0;

  const overallTone = getProfitTone(
    netProfit,
    hasFinancialData,
  );

  const overallStatus = getProfitStatus(
    netProfit,
    hasFinancialData,
  );

  const expenseTone = getExpenseTone(
    totalExpenses,
    grossRevenue,
  );

  const expenseStatus = getExpenseStatus(
    totalExpenses,
    grossRevenue,
  );

  const profitPerMileTone =
    getProfitPerMileTone(profitPerMile);

  const profitPerMileStatus =
    getProfitPerMileStatus(profitPerMile);

  const dashboardMetrics: DashboardMetric[] = [
    {
      label: "Gross revenue",
      value: formatCurrency(grossRevenue),
      detail:
        completedLoads.length === 1
          ? "1 completed load"
          : `${completedLoads.length} completed loads`,
      statusLabel:
        completedLoads.length > 0
          ? "Revenue recorded"
          : "No data",
      tone:
        completedLoads.length > 0
          ? "neutral"
          : "neutral",
    },
    {
      label: "Total expenses",
      value: formatCurrency(totalExpenses),
      detail:
        totalExpenses > 0 && grossRevenue > 0
          ? `${Math.round(
              (totalExpenses / grossRevenue) * 100,
            )}% of gross revenue`
          : "No expenses recorded",
      statusLabel: expenseStatus,
      tone: expenseTone,
    },
    {
      label: "Net profit",
      value: formatCurrency(netProfit),
      detail:
        hasFinancialData
          ? "Before estimated taxes"
          : "Add records to calculate profit",
      statusLabel: overallStatus,
      tone: overallTone,
    },
    {
      label: "Profit per mile",
      value: formatRate(profitPerMile),
      detail:
        totalMiles > 0
          ? `${formatNumber(totalMiles)} total miles`
          : "No mileage recorded",
      statusLabel: profitPerMileStatus,
      tone: profitPerMileTone,
    },
  ];

  const breakEvenTone: StatusTone =
    !hasBreakEvenData
      ? "neutral"
      : grossRevenue >= totalExpenses
        ? "good"
        : grossRevenue >= totalExpenses * 0.8
          ? "warning"
          : "bad";

  const breakEvenStatus =
    !hasBreakEvenData
      ? "Not calculated"
      : grossRevenue >= totalExpenses
        ? "Good standing"
        : grossRevenue >= totalExpenses * 0.8
          ? "Getting close"
          : "Below break-even";

  return (
    <main className="min-h-screen pb-24 lg:pb-8">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xl font-black tracking-tight text-white">
              Axle
              <span className="text-sky-400">
                ledger
              </span>
            </p>

            <p className="mt-0.5 text-xs text-slate-500">
              Know what every mile earns.
            </p>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            {navigationItems.map(
              (item, index) =>
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={
                      index === 0
                        ? "rounded-xl bg-sky-400/10 px-4 py-2.5 text-sm font-semibold text-sky-300"
                        : "rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-400 transition hover:bg-slate-900 hover:text-white"
                    }
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    key={item.label}
                    aria-disabled="true"
                    title="Coming soon"
                    className="cursor-not-allowed rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600"
                  >
                    {item.label}
                  </span>
                ),
            )}
          </div>

          <button
            type="button"
            aria-label="Open account menu"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-bold text-slate-200 transition hover:border-sky-400"
          >
            LC
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-sky-400">
              Current performance
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Driver dashboard
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Add loads, expenses, settlements, and fixed
              costs to automatically calculate your actual
              operating performance.
            </p>
          </div>

          <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-400 sm:w-52">
            Reporting period

            <select
              defaultValue="all-time"
              disabled
              className="cursor-not-allowed rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white opacity-80 outline-none"
            >
              <option value="all-time">
                All recorded data
              </option>
            </select>
          </label>
        </section>

        {hasDashboardQueryError ? (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-200"
          >
            Axleledger could not retrieve all
            dashboard records. Refresh the page
            or try again shortly.
          </div>
        ) : null}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {dashboardMetrics.map((metric) => (
            <MetricCard
              key={metric.label}
              metric={metric}
            />
          ))}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-sky-400">
                  Period performance
                </p>

                <h2 className="mt-1 text-xl font-bold text-white">
                  Revenue versus break-even
                </h2>
              </div>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold ${toneStyles[breakEvenTone].badge}`}
              >
                {breakEvenStatus}
              </span>
            </div>

            {hasBreakEvenData ? (
              <div className="mt-8">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-400">
                      Current revenue
                    </p>

                    <p className="mt-1 text-3xl font-black text-white">
                      {formatCurrency(grossRevenue)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-slate-400">
                      Break-even point
                    </p>

                    <p className="mt-1 text-lg font-bold text-slate-200">
                      {formatCurrency(totalExpenses)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${toneStyles[breakEvenTone].dot}`}
                    style={{
                      width: `${breakEvenProgress}%`,
                    }}
                  />
                </div>

                <div className="mt-3 flex justify-between text-xs text-slate-500">
                  <span>$0</span>
                  <span>
                    {Math.round(breakEvenProgress)}%
                    toward break-even
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-5 py-8 text-center">
                <p className="font-bold text-white">
                  Break-even is not available yet
                </p>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Add your truck payment, insurance,
                  recurring deductions, and operating
                  expenses to calculate the amount you must
                  earn before becoming profitable.
                </p>
              </div>
            )}

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-950/70 p-4">
                <p className="text-xs text-slate-500">
                  Loaded miles
                </p>

                <p className="mt-1 text-lg font-bold text-white">
                  {formatNumber(loadedMiles)}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950/70 p-4">
                <p className="text-xs text-slate-500">
                  Deadhead miles
                </p>

                <p className="mt-1 text-lg font-bold text-white">
                  {formatNumber(deadheadMiles)}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950/70 p-4">
                <p className="text-xs text-slate-500">
                  Deadhead rate
                </p>

                <p className="mt-1 text-lg font-bold text-white">
                  {deadheadRate === null
                    ? "—"
                    : `${deadheadRate.toFixed(1)}%`}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
            <p className="text-sm font-semibold text-sky-400">
              Quick entry
            </p>

            <h2 className="mt-1 text-xl font-bold text-white">
              What do you need to record?
            </h2>

            <div className="mt-5 grid gap-3">
              {quickActions.map((action) =>
                action.href ? (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left transition hover:border-sky-400/60 hover:bg-slate-900"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-400/10 text-lg font-black text-sky-300">
                      {action.symbol}
                    </span>

                    <span>
                      <span className="block font-bold text-white">
                        {action.label}
                      </span>

                      <span className="mt-1 block text-xs text-slate-500">
                        {
                          action.description
                        }
                      </span>
                    </span>
                  </Link>
                ) : (
                  <div
                    key={action.label}
                    aria-disabled="true"
                    title="Coming soon"
                    className="flex cursor-not-allowed items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-left opacity-60"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-lg font-black text-slate-500">
                      {action.symbol}
                    </span>

                    <span>
                      <span className="block font-bold text-slate-300">
                        {action.label}
                      </span>

                      <span className="mt-1 block text-xs text-slate-600">
                        Coming soon ·{" "}
                        {
                          action.description
                        }
                      </span>
                    </span>
                  </div>
                ),
              )}
            </div>
          </article>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-5 sm:px-6">
            <div>
              <p className="text-sm font-semibold text-sky-400">
                Recent activity
              </p>

              <h2 className="mt-1 text-xl font-bold text-white">
                Latest transactions
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/loads"
                className="text-sm font-bold text-slate-400 transition hover:text-white"
              >
                Loads
              </Link>

              <Link
                href="/expenses"
                className="text-sm font-bold text-sky-400 transition hover:text-sky-300"
              >
                Expenses
              </Link>
            </div>
          </div>

          {recentActivity.length === 0 ? (
            <div className="px-5 py-12 text-center sm:px-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-xl font-black text-slate-400">
                0
              </div>

              <p className="mt-4 font-bold text-white">
                No activity recorded yet
              </p>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Your completed loads, expenses,
                settlements, and deductions will appear
                here after you begin entering records.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {recentActivity.map((activity) => (
                <article
                  key={activity.id}
                  className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">
                      {activity.title}
                    </p>

                    <p className="mt-1 truncate text-sm text-slate-500">
                      {activity.description}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={
                        activity.type === "income"
                          ? "font-bold text-emerald-400"
                          : "font-bold text-slate-200"
                      }
                    >
                      {activity.type === "income"
                        ? "+"
                        : "−"}
                      {formatCurrency(
                        Math.abs(activity.amount),
                      )}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {activity.occurredAt}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm font-medium text-slate-400">
              Average revenue per load
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {averageRevenuePerLoad === null
                ? "—"
                : formatCurrency(
                    averageRevenuePerLoad,
                  )}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Calculated from completed loads
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm font-medium text-slate-400">
              Average fuel cost per mile
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {fuelCostPerMile === null
                ? "—"
                : formatCurrency(fuelCostPerMile)}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Calculated from fuel expenses and miles
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm font-medium text-slate-400">
              Estimated tax reserve
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {estimatedTaxReserve === null
                ? "—"
                : formatCurrency(
                    estimatedTaxReserve,
                  )}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Initial estimate: 25% of positive profit
            </p>
          </article>
        </section>

        <div className="mt-6 rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3 text-xs leading-5 text-sky-100/80">
          This dashboard contains no demonstration
          transactions. Totals will calculate automatically
          from the records entered into Axleledger.
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {navigationItems.map(
            (item, index) =>
              item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className={
                    index === 0
                      ? "rounded-xl bg-sky-400/10 px-2 py-3 text-center text-xs font-bold text-sky-300"
                      : "rounded-xl px-2 py-3 text-center text-xs font-semibold text-slate-500 transition hover:text-slate-200"
                  }
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  key={item.label}
                  aria-disabled="true"
                  title="Coming soon"
                  className="cursor-not-allowed rounded-xl px-2 py-3 text-center text-xs font-semibold text-slate-700"
                >
                  {item.label}
                </span>
              ),
          )}
        </div>
      </nav>
    </main>
  );
}