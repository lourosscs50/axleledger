import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  ReportingPeriodSelect,
  type ReportingPeriod,
} from "./reporting-period-select";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Axleledger driver financial dashboard.",
};

type LoadStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled";

type LoadRecord = {
  id: string;
  load_number: string;
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
};

type ExpenseCategory =
  | "fuel"
  | "def"
  | "maintenance"
  | "tolls"
  | "parking"
  | "scales"
  | "food"
  | "supplies"
  | "other";

type ExpenseRecord = {
  id: string;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  vendor: string | null;
};

type SettlementRecord = {
  id: string;
  settlement_date: string;
  carrier_or_company: string | null;
  gross_pay: number;
  deductions: number;
  reimbursements: number;
  net_deposit: number;
  status:
    | "draft"
    | "review_needed"
    | "approved"
    | "paid"
    | "reopened";
};

type FixedCostRecord = {
  id: string;
  name: string;
  amount: number;
  frequency: "weekly" | "monthly";
  effective_date: string;
  is_active: boolean;
};

type ActivityRecord = {
  id: string;
  title: string;
  description: string;
  amount: number;
  occurredAt: string;
  sortDate: string;
  type: "income" | "expense";
};

type StatusTone =
  | "neutral"
  | "good"
  | "warning"
  | "bad";

type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  statusLabel: string;
  tone: StatusTone;
};

type HomePageProps = {
  searchParams: Promise<{
    period?: string;
  }>;
};

const navigationItems = [
  {
    label: "Dashboard",
    mobileLabel: "Home",
    href: "/",
  },
  {
    label: "Loads",
    mobileLabel: "Loads",
    href: "/loads",
  },
  {
    label: "Expenses",
    mobileLabel: "Expenses",
    href: "/expenses",
  },
  {
    label: "Fuel",
    mobileLabel: "Fuel",
    href: "/fuel",
  },
  {
    label: "Settlements",
    mobileLabel: "Pay",
    href: "/settlements",
  },
  {
    label: "Fixed costs",
    mobileLabel: "Costs",
    href: "/fixed-costs",
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
      "Record tolls, maintenance, parking, and more",
    symbol: "−",
    href: "/expenses#expense-form",
  },
  {
    label: "Add fuel or DEF",
    description:
      "Capture gallons, pricing, discount, and odometer",
    symbol: "F",
    href: "/fuel#fuel-entry",
  },
  {
    label: "Add settlement",
    description:
      "Record deductions and your actual deposit",
    symbol: "$",
    href: "/settlements#settlement-form",
  },
  {
    label: "Manage fixed costs",
    description:
      "Set truck payment, insurance, and recurring costs",
    symbol: "=",
    href: "/fixed-costs#fixed-cost-form",
  },
] as const;

const periodLabels: Record<
  ReportingPeriod,
  string
> = {
  this_week: "This week",
  last_week: "Last week",
  this_month: "This month",
  year_to_date: "Year to date",
  all_time: "All time",
};

const expenseLabels: Record<
  ExpenseCategory,
  string
> = {
  fuel: "Fuel",
  def: "DEF",
  maintenance: "Maintenance",
  tolls: "Tolls",
  parking: "Parking",
  scales: "Scales",
  food: "Food",
  supplies: "Supplies",
  other: "Other",
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

function formatRate(value: number | null) {
  return value === null
    ? "—"
    : formatCurrency(value);
}

function formatActivityDate(
  value: string,
) {
  return dateFormatter.format(
    new Date(`${value}T00:00:00Z`),
  );
}

function parseDateOnly(value: string) {
  const [year, month, day] = value
    .split("-")
    .map(Number);

  return new Date(
    Date.UTC(year, month - 1, day),
  );
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(
  value: Date,
  amount: number,
) {
  const result = new Date(value);

  result.setUTCDate(
    result.getUTCDate() + amount,
  );

  return result;
}

function getTodayDateString() {
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

function getReportingPeriod(
  value: string | undefined,
): ReportingPeriod {
  const allowedPeriods =
    new Set<ReportingPeriod>([
      "this_week",
      "last_week",
      "this_month",
      "year_to_date",
      "all_time",
    ]);

  return allowedPeriods.has(
    value as ReportingPeriod,
  )
    ? (value as ReportingPeriod)
    : "this_week";
}

function resolvePeriodRange(
  period: ReportingPeriod,
  todayValue: string,
  allDates: string[],
) {
  const today =
    parseDateOnly(todayValue);

  const dayOfWeek =
    today.getUTCDay();

  const daysSinceMonday =
    (dayOfWeek + 6) % 7;

  const thisWeekStart = addDays(
    today,
    -daysSinceMonday,
  );

  if (period === "this_week") {
    return {
      start: formatDateOnly(
        thisWeekStart,
      ),
      end: todayValue,
    };
  }

  if (period === "last_week") {
    return {
      start: formatDateOnly(
        addDays(thisWeekStart, -7),
      ),
      end: formatDateOnly(
        addDays(thisWeekStart, -1),
      ),
    };
  }

  if (period === "this_month") {
    return {
      start: `${todayValue.slice(
        0,
        7,
      )}-01`,
      end: todayValue,
    };
  }

  if (period === "year_to_date") {
    return {
      start: `${todayValue.slice(
        0,
        4,
      )}-01-01`,
      end: todayValue,
    };
  }

  const validDates = allDates
    .filter(Boolean)
    .sort();

  return {
    start:
      validDates[0] ?? todayValue,
    end: todayValue,
  };
}

function isWithinPeriod(
  value: string,
  start: string,
  end: string,
) {
  return value >= start && value <= end;
}

function daysInclusive(
  start: string,
  end: string,
) {
  const milliseconds =
    parseDateOnly(end).getTime() -
    parseDateOnly(start).getTime();

  return (
    Math.floor(
      milliseconds /
        (1000 * 60 * 60 * 24),
    ) + 1
  );
}

function recurringCostForPeriod(
  fixedCost: FixedCostRecord,
  periodStart: string,
  periodEnd: string,
) {
  if (
    !fixedCost.is_active ||
    fixedCost.effective_date >
      periodEnd
  ) {
    return 0;
  }

  const effectiveStart =
    fixedCost.effective_date >
    periodStart
      ? fixedCost.effective_date
      : periodStart;

  const days = daysInclusive(
    effectiveStart,
    periodEnd,
  );

  const divisor =
    fixedCost.frequency === "weekly"
      ? 7
      : 30.4375;

  return (
    Number(fixedCost.amount) *
    (days / divisor)
  );
}

function sumValues<T>(
  records: T[],
  selector: (record: T) => number,
) {
  return records.reduce(
    (total, record) =>
      total + selector(record),
    0,
  );
}

function getProfitTone(
  value: number,
  hasData: boolean,
): StatusTone {
  if (!hasData) {
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
  hasData: boolean,
) {
  if (!hasData) {
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

function getExpenseTone(
  expenseTotal: number,
  incomeTotal: number,
): StatusTone {
  if (
    expenseTotal === 0 &&
    incomeTotal === 0
  ) {
    return "neutral";
  }

  if (
    incomeTotal === 0 &&
    expenseTotal > 0
  ) {
    return "bad";
  }

  const ratio =
    expenseTotal / incomeTotal;

  if (ratio <= 0.6) {
    return "good";
  }

  if (ratio <= 0.8) {
    return "warning";
  }

  return "bad";
}

function getExpenseStatus(
  expenseTotal: number,
  incomeTotal: number,
) {
  const tone = getExpenseTone(
    expenseTotal,
    incomeTotal,
  );

  if (tone === "neutral") {
    return "No data";
  }

  if (tone === "good") {
    return "Good standing";
  }

  if (tone === "warning") {
    return "Needs attention";
  }

  return incomeTotal === 0
    ? "Costs without income"
    : "Expenses too high";
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
  const styles =
    toneStyles[metric.tone];

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

export default async function Home({
  searchParams,
}: HomePageProps) {
  const { period: rawPeriod } =
    await searchParams;

  const period =
    getReportingPeriod(rawPeriod);

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
      error: loadsError,
    },
    {
      data: expensesData,
      error: expensesError,
    },
    {
      data: settlementsData,
      error: settlementsError,
    },
    {
      data: fixedCostsData,
      error: fixedCostsError,
    },
  ] = await Promise.all([
    supabase
      .from("loads")
      .select(
        `
          id,
          load_number,
          origin_city,
          origin_state,
          destination_city,
          destination_state,
          pickup_date,
          delivery_date,
          gross_revenue,
          loaded_miles,
          deadhead_miles,
          status
        `,
      )
      .eq("user_id", userId),
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
      .eq("user_id", userId),
    supabase
      .from("settlements")
      .select(
        `
          id,
          settlement_date,
          carrier_or_company,
          gross_pay,
          deductions,
          reimbursements,
          net_deposit,
          status
        `,
      )
      .eq("user_id", userId),
    supabase
      .from("fixed_costs")
      .select(
        `
          id,
          name,
          amount,
          frequency,
          effective_date,
          is_active
        `,
      )
      .eq("user_id", userId),
  ]);

  if (loadsError) {
    console.error(
      "Dashboard loads query failed:",
      loadsError,
    );
  }

  if (expensesError) {
    console.error(
      "Dashboard expenses query failed:",
      expensesError,
    );
  }

  if (settlementsError) {
    console.error(
      "Dashboard settlements query failed:",
      settlementsError,
    );
  }

  if (fixedCostsError) {
    console.error(
      "Dashboard fixed costs query failed:",
      fixedCostsError,
    );
  }

  const loads =
    (loadsData ?? []) as LoadRecord[];

  const expenses =
    (expensesData ??
      []) as ExpenseRecord[];

  const settlements =
    (settlementsData ??
      []) as SettlementRecord[];

  const fixedCosts =
    (fixedCostsData ??
      []) as FixedCostRecord[];

  const today =
    getTodayDateString();

  const allDates = [
    ...loads.map(
      (load) =>
        load.delivery_date ??
        load.pickup_date,
    ),
    ...expenses.map(
      (expense) =>
        expense.expense_date,
    ),
    ...settlements.map(
      (settlement) =>
        settlement.settlement_date,
    ),
    ...fixedCosts.map(
      (fixedCost) =>
        fixedCost.effective_date,
    ),
  ];

  const {
    start: periodStart,
    end: periodEnd,
  } = resolvePeriodRange(
    period,
    today,
    allDates,
  );

  const completedLoads =
    loads.filter((load) => {
      const completedDate =
        load.delivery_date ??
        load.pickup_date;

      return (
        load.status === "completed" &&
        isWithinPeriod(
          completedDate,
          periodStart,
          periodEnd,
        )
      );
    });

  const periodExpenses =
    expenses.filter((expense) =>
      isWithinPeriod(
        expense.expense_date,
        periodStart,
        periodEnd,
      ),
    );

  const recognizedSettlements =
    settlements.filter(
      (settlement) =>
        settlement.status ===
          "approved" ||
        settlement.status === "paid",
    );

  const periodSettlements =
    recognizedSettlements.filter(
      (settlement) =>
        isWithinPeriod(
          settlement.settlement_date,
          periodStart,
          periodEnd,
        ),
    );

  const paidPeriodSettlements =
    periodSettlements.filter(
      (settlement) =>
        settlement.status === "paid",
    );

  const activeFixedCosts =
    fixedCosts.filter(
      (fixedCost) =>
        fixedCost.is_active &&
        fixedCost.effective_date <=
          periodEnd,
    );

  const grossRevenue = sumValues(
    completedLoads,
    (load) =>
      Number(load.gross_revenue),
  );

  const reimbursements = sumValues(
    periodSettlements,
    (settlement) =>
      Number(
        settlement.reimbursements,
      ),
  );

  const totalIncome =
    grossRevenue + reimbursements;

  const directExpenses = sumValues(
    periodExpenses,
    (expense) =>
      Number(expense.amount),
  );

  const settlementDeductions =
    sumValues(
      periodSettlements,
      (settlement) =>
        Number(
          settlement.deductions,
        ),
    );

  const recurringCosts = sumValues(
    activeFixedCosts,
    (fixedCost) =>
      recurringCostForPeriod(
        fixedCost,
        periodStart,
        periodEnd,
      ),
  );

  const totalExpenses =
    directExpenses +
    settlementDeductions +
    recurringCosts;

  const netProfit =
    totalIncome - totalExpenses;

  const loadedMiles = sumValues(
    completedLoads,
    (load) =>
      Number(load.loaded_miles),
  );

  const deadheadMiles = sumValues(
    completedLoads,
    (load) =>
      Number(load.deadhead_miles),
  );

  const totalMiles =
    loadedMiles + deadheadMiles;

  const profitPerMile =
    totalMiles > 0
      ? netProfit / totalMiles
      : null;

  const deadheadRate =
    totalMiles > 0
      ? (deadheadMiles /
          totalMiles) *
        100
      : null;

  const averageRevenuePerLoad =
    completedLoads.length > 0
      ? grossRevenue /
        completedLoads.length
      : null;

  const fuelExpenses = sumValues(
    periodExpenses.filter(
      (expense) =>
        expense.category === "fuel",
    ),
    (expense) =>
      Number(expense.amount),
  );

  const fuelCostPerMile =
    totalMiles > 0 &&
    fuelExpenses > 0
      ? fuelExpenses / totalMiles
      : null;

  const netDeposits = sumValues(
    paidPeriodSettlements,
    (settlement) =>
      Number(
        settlement.net_deposit,
      ),
  );

  const estimatedTaxReserve =
    netProfit > 0
      ? netProfit * 0.25
      : null;

  const hasFinancialData =
    completedLoads.length > 0 ||
    periodExpenses.length > 0 ||
    periodSettlements.length > 0 ||
    recurringCosts > 0;

  const overallTone =
    getProfitTone(
      netProfit,
      hasFinancialData,
    );

  const overallStatus =
    getProfitStatus(
      netProfit,
      hasFinancialData,
    );

  const expenseTone =
    getExpenseTone(
      totalExpenses,
      totalIncome,
    );

  const expenseStatus =
    getExpenseStatus(
      totalExpenses,
      totalIncome,
    );

  const profitPerMileTone =
    getProfitPerMileTone(
      profitPerMile,
    );

  const profitPerMileStatus =
    getProfitPerMileStatus(
      profitPerMile,
    );

  const dashboardMetrics: DashboardMetric[] =
    [
      {
        label: "Gross revenue",
        value:
          formatCurrency(grossRevenue),
        detail:
          completedLoads.length === 1
            ? "1 completed load"
            : `${completedLoads.length} completed loads`,
        statusLabel:
          completedLoads.length > 0
            ? "Revenue recorded"
            : "No data",
        tone: "neutral",
      },
      {
        label: "Total expenses",
        value:
          formatCurrency(totalExpenses),
        detail:
          totalIncome > 0
            ? `${Math.round(
                (totalExpenses /
                  totalIncome) *
                  100,
              )}% of income`
            : "Direct, settlement, and recurring costs",
        statusLabel:
          expenseStatus,
        tone: expenseTone,
      },
      {
        label: "Net profit",
        value:
          formatCurrency(netProfit),
        detail:
          reimbursements > 0
            ? `Includes ${formatCurrency(
                reimbursements,
              )} reimbursements`
            : "Before estimated taxes",
        statusLabel:
          overallStatus,
        tone: overallTone,
      },
      {
        label: "Profit per mile",
        value:
          formatRate(
            profitPerMile,
          ),
        detail:
          totalMiles > 0
            ? `${formatNumber(
                totalMiles,
              )} total miles`
            : "No mileage recorded",
        statusLabel:
          profitPerMileStatus,
        tone:
          profitPerMileTone,
      },
    ];

  const hasBreakEvenData =
    totalExpenses > 0;

  const breakEvenProgress =
    hasBreakEvenData
      ? Math.min(
          (totalIncome /
            totalExpenses) *
            100,
          100,
        )
      : 0;

  const breakEvenTone: StatusTone =
    !hasBreakEvenData
      ? "neutral"
      : totalIncome >= totalExpenses
        ? "good"
        : totalIncome >=
            totalExpenses * 0.8
          ? "warning"
          : "bad";

  const breakEvenStatus =
    !hasBreakEvenData
      ? "Not calculated"
      : totalIncome >= totalExpenses
        ? "Good standing"
        : totalIncome >=
            totalExpenses * 0.8
          ? "Getting close"
          : "Below break-even";

  const recentActivity: ActivityRecord[] =
    [
      ...completedLoads.map(
        (load) => {
          const activityDate =
            load.delivery_date ??
            load.pickup_date;

          return {
            id: `load-${load.id}`,
            title: load.load_number,
            description:
              `${load.origin_city}, ${load.origin_state} → ${load.destination_city}, ${load.destination_state}`,
            amount: Number(
              load.gross_revenue,
            ),
            occurredAt:
              formatActivityDate(
                activityDate,
              ),
            sortDate: activityDate,
            type: "income" as const,
          };
        },
      ),
      ...periodExpenses.map(
        (expense) => ({
          id: `expense-${expense.id}`,
          title:
            expense.vendor ??
            `${expenseLabels[
              expense.category
            ]} expense`,
          description:
            expenseLabels[
              expense.category
            ],
          amount: Number(
            expense.amount,
          ),
          occurredAt:
            formatActivityDate(
              expense.expense_date,
            ),
          sortDate:
            expense.expense_date,
          type: "expense" as const,
        }),
      ),
      ...paidPeriodSettlements.map(
        (settlement) => ({
          id: `settlement-${settlement.id}`,
          title:
            settlement.carrier_or_company ??
            "Settlement deposit",
          description:
            "Settlement bank deposit",
          amount: Number(
            settlement.net_deposit,
          ),
          occurredAt:
            formatActivityDate(
              settlement.settlement_date,
            ),
          sortDate:
            settlement.settlement_date,
          type: "income" as const,
        }),
      ),
    ]
      .sort((first, second) =>
        second.sortDate.localeCompare(
          first.sortDate,
        ),
      )
      .slice(0, 8);

  const hasQueryError = Boolean(
    loadsError ||
      expensesError ||
      settlementsError ||
      fixedCostsError,
  );

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

          <nav className="hidden items-center gap-1 lg:flex">
            {navigationItems.map(
              (item, index) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={
                    index === 0
                      ? "rounded-xl bg-sky-400/10 px-3 py-2.5 text-sm font-semibold text-sky-300"
                      : "rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400 transition hover:bg-slate-900 hover:text-white"
                  }
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <div
            aria-label="Account"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-bold text-slate-200"
          >
            LC
          </div>
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
              Live operating performance for{" "}
              <span className="font-semibold text-slate-200">
                {periodLabels[period]}
              </span>
              .
            </p>
          </div>

          <ReportingPeriodSelect
            value={period}
          />
        </section>

        {hasQueryError ? (
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
          {dashboardMetrics.map(
            (metric) => (
              <MetricCard
                key={metric.label}
                metric={metric}
              />
            ),
          )}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-sky-400">
                  Period performance
                </p>

                <h2 className="mt-1 text-xl font-bold text-white">
                  Income versus break-even
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
                      Income
                    </p>

                    <p className="mt-1 text-3xl font-black text-white">
                      {formatCurrency(
                        totalIncome,
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-slate-400">
                      Break-even point
                    </p>

                    <p className="mt-1 text-lg font-bold text-slate-200">
                      {formatCurrency(
                        totalExpenses,
                      )}
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

                <p className="mt-3 text-xs text-slate-500">
                  {Math.round(
                    breakEvenProgress,
                  )}
                  % toward break-even
                </p>
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-5 py-8 text-center">
                <p className="font-bold text-white">
                  Break-even is not available
                  yet
                </p>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Add expenses, settlement
                  deductions, and fixed costs to
                  calculate your break-even point.
                </p>
              </div>
            )}

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-950/70 p-4">
                <p className="text-xs text-slate-500">
                  Loaded miles
                </p>

                <p className="mt-1 text-lg font-bold text-white">
                  {formatNumber(
                    loadedMiles,
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950/70 p-4">
                <p className="text-xs text-slate-500">
                  Deadhead miles
                </p>

                <p className="mt-1 text-lg font-bold text-white">
                  {formatNumber(
                    deadheadMiles,
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950/70 p-4">
                <p className="text-xs text-slate-500">
                  Deadhead rate
                </p>

                <p className="mt-1 text-lg font-bold text-white">
                  {deadheadRate === null
                    ? "—"
                    : `${deadheadRate.toFixed(
                        1,
                      )}%`}
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
              {quickActions.map(
                (action) => (
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
                ),
              )}
            </div>
          </article>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Direct expenses
            </p>

            <p className="mt-3 text-xl font-black text-white">
              {formatCurrency(
                directExpenses,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Settlement deductions
            </p>

            <p className="mt-3 text-xl font-black text-white">
              {formatCurrency(
                settlementDeductions,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Prorated fixed costs
            </p>

            <p className="mt-3 text-xl font-black text-white">
              {formatCurrency(
                recurringCosts,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Settlement deposits
            </p>

            <p className="mt-3 text-xl font-black text-emerald-400">
              {formatCurrency(
                netDeposits,
              )}
            </p>
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
          </div>

          {recentActivity.length === 0 ? (
            <div className="px-5 py-12 text-center sm:px-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-xl font-black text-slate-400">
                0
              </div>

              <p className="mt-4 font-bold text-white">
                No activity in this period
              </p>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Change the reporting period or
                begin entering records.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {recentActivity.map(
                (activity) => (
                  <article
                    key={activity.id}
                    className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-white">
                        {activity.title}
                      </p>

                      <p className="mt-1 truncate text-sm text-slate-500">
                        {
                          activity.description
                        }
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p
                        className={
                          activity.type ===
                          "income"
                            ? "font-bold text-emerald-400"
                            : "font-bold text-slate-200"
                        }
                      >
                        {activity.type ===
                        "income"
                          ? "+"
                          : "−"}
                        {formatCurrency(
                          Math.abs(
                            activity.amount,
                          ),
                        )}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {
                          activity.occurredAt
                        }
                      </p>
                    </div>
                  </article>
                ),
              )}
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm font-medium text-slate-400">
              Average revenue per load
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {averageRevenuePerLoad ===
              null
                ? "—"
                : formatCurrency(
                    averageRevenuePerLoad,
                  )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm font-medium text-slate-400">
              Fuel cost per mile
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {fuelCostPerMile === null
                ? "—"
                : formatCurrency(
                    fuelCostPerMile,
                  )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm font-medium text-slate-400">
              Reimbursements
            </p>

            <p className="mt-3 text-2xl font-black text-sky-400">
              {formatCurrency(
                reimbursements,
              )}
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
          </article>
        </section>

        <div className="mt-6 rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3 text-xs leading-5 text-sky-100/80">
          Active fixed costs are prorated across
          the selected reporting period.
          Only approved and paid settlements
          contribute deductions and reimbursements.
          Only paid settlements appear as cash
          deposits, preventing draft values from
          affecting operating results.
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950/95 px-2 py-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-6 gap-1">
          {navigationItems.map(
            (item, index) => (
              <Link
                key={item.label}
                href={item.href}
                className={
                  index === 0
                    ? "rounded-xl bg-sky-400/10 px-1 py-3 text-center text-xs font-bold text-sky-300"
                    : "rounded-xl px-1 py-3 text-center text-xs font-semibold text-slate-500 transition hover:text-slate-200"
                }
              >
                {item.mobileLabel}
              </Link>
            ),
          )}
        </div>
      </nav>
    </main>
  );
}
