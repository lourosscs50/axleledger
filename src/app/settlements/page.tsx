import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { AdjustmentForm } from "./adjustment-form";
import { DeleteLineItemForm } from "./delete-line-item-form";
import { DeleteSettlementForm } from "./delete-settlement-form";
import { ExpenseReconciliationForm } from "./expense-reconciliation-form";
import { LifecycleActions } from "./lifecycle-actions";
import { LineItemForm } from "./line-item-form";
import { SettlementForm } from "./settlement-form";
import { UnlinkExpenseForm } from "./unlink-expense-form";
import type {
  ApprovalSnapshotRecord,
  ExpenseOption,
  LoadOption,
  SettlementAdjustmentRecord,
  SettlementAuditRecord,
  SettlementLineItemRecord,
  SettlementRecord,
  SettlementStatus,
} from "./types";

export const metadata: Metadata = {
  title: "Settlements",
  description:
    "Manage Axleledger settlement lifecycle, line items, approvals, and corrections.",
};

type SettlementsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    edit?: string;
    manage?: string;
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

const dateTimeFormatter =
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });

const statusDetails: Record<
  SettlementStatus,
  {
    label: string;
    description: string;
    className: string;
  }
> = {
  draft: {
    label: "Draft",
    description:
      "Metadata, line items, and load links are editable.",
    className:
      "border-slate-700 bg-slate-800 text-slate-300",
  },
  review_needed: {
    label: "Review needed",
    description:
      "Values are locked while the settlement awaits approval.",
    className:
      "border-amber-400/20 bg-amber-400/10 text-amber-300",
  },
  approved: {
    label: "Approved",
    description:
      "An immutable approval snapshot has been preserved.",
    className:
      "border-sky-400/20 bg-sky-400/10 text-sky-300",
  },
  paid: {
    label: "Paid",
    description:
      "The settlement has been approved and confirmed paid.",
    className:
      "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  },
  reopened: {
    label: "Reopened",
    description:
      "Corrections are editable while prior snapshots remain preserved.",
    className:
      "border-violet-400/20 bg-violet-400/10 text-violet-300",
  },
};

const lineItemDetails = {
  earning: {
    label: "Earning",
    className:
      "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    amountClassName: "text-emerald-400",
    sign: "+",
  },
  deduction: {
    label: "Deduction",
    className:
      "border-amber-400/20 bg-amber-400/10 text-amber-300",
    amountClassName: "text-amber-400",
    sign: "−",
  },
  reimbursement: {
    label: "Reimbursement",
    className:
      "border-sky-400/20 bg-sky-400/10 text-sky-300",
    amountClassName: "text-sky-400",
    sign: "+",
  },
} as const;

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

function formatDateTime(value: string) {
  return dateTimeFormatter.format(
    new Date(value),
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

function groupBySettlement<T extends {
  settlement_id: string;
}>(records: T[]) {
  const grouped = new Map<string, T[]>();

  records.forEach((record) => {
    const current =
      grouped.get(record.settlement_id) ??
      [];

    current.push(record);
    grouped.set(
      record.settlement_id,
      current,
    );
  });

  return grouped;
}

function isEditable(
  status: SettlementStatus,
) {
  return (
    status === "draft" ||
    status === "reopened"
  );
}

function auditDetail(
  audit: SettlementAuditRecord,
) {
  const reason = audit.details.reason;
  const amount = audit.details.amount;
  const version =
    audit.details.approval_version;

  if (typeof reason === "string") {
    return reason;
  }

  if (typeof amount === "number") {
    return `Adjustment ${formatCurrency(
      amount,
    )}`;
  }

  if (typeof version === "number") {
    return `Approval version ${version}`;
  }

  return null;
}

export default async function SettlementsPage({
  searchParams,
}: SettlementsPageProps) {
  const {
    error,
    success,
    edit,
    manage,
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
      data: settlementsData,
      error: settlementsError,
    },
    {
      data: lineItemsData,
      error: lineItemsError,
    },
    {
      data: adjustmentsData,
      error: adjustmentsError,
    },
    {
      data: auditData,
      error: auditError,
    },
    {
      data: snapshotsData,
      error: snapshotsError,
    },
    {
      data: loadsData,
      error: loadsError,
    },
    {
      data: expensesData,
      error: expensesError,
    },
  ] = await Promise.all([
    supabase
      .from("settlements")
      .select(
        `
          id,
          statement_number,
          settlement_date,
          period_start_date,
          period_end_date,
          carrier_or_company,
          gross_pay,
          deductions,
          reimbursements,
          net_deposit,
          status,
          review_submitted_at,
          approved_at,
          paid_at,
          reopened_at,
          approval_version,
          notes,
          created_at
        `,
      )
      .eq("user_id", userId)
      .order("settlement_date", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      }),
    supabase
      .from("settlement_line_items")
      .select(
        `
          id,
          settlement_id,
          load_id,
          expense_id,
          source_type,
          source_amount,
          variance_reason,
          kind,
          category,
          description,
          amount,
          authorization_reference,
          balance_after,
          created_at
        `,
      )
      .eq("user_id", userId)
      .order("created_at", {
        ascending: true,
      }),
    supabase
      .from("settlement_adjustments")
      .select(
        `
          id,
          settlement_id,
          amount,
          reason,
          created_at
        `,
      )
      .eq("user_id", userId)
      .order("created_at", {
        ascending: true,
      }),
    supabase
      .from("settlement_audit_events")
      .select(
        `
          id,
          settlement_id,
          event_type,
          from_status,
          to_status,
          details,
          created_at
        `,
      )
      .eq("user_id", userId)
      .order("created_at", {
        ascending: false,
      }),
    supabase
      .from("settlement_approval_snapshots")
      .select(
        `
          id,
          settlement_id,
          approval_version,
          created_at
        `,
      )
      .eq("user_id", userId)
      .order("approval_version", {
        ascending: false,
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
      .from("expenses")
      .select(
        `
          id,
          load_id,
          category,
          amount,
          expense_date,
          vendor,
          notes
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

  const settlements =
    (settlementsData ??
      []) as SettlementRecord[];

  const lineItems =
    (lineItemsData ??
      []) as SettlementLineItemRecord[];

  const adjustments =
    (adjustmentsData ??
      []) as SettlementAdjustmentRecord[];

  const auditEvents =
    (auditData ??
      []) as SettlementAuditRecord[];

  const snapshots =
    (snapshotsData ??
      []) as ApprovalSnapshotRecord[];

  const loads =
    (loadsData ?? []) as LoadOption[];

  const expenseRecords =
    (expensesData ?? []) as Array<
      Omit<ExpenseOption, "load_label">
    >;

  const loadsById = new Map(
    loads.map((load) => [load.id, load]),
  );

  const lineItemsBySettlement =
    groupBySettlement(lineItems);

  const adjustmentsBySettlement =
    groupBySettlement(adjustments);

  const auditBySettlement =
    groupBySettlement(auditEvents);

  const snapshotsBySettlement =
    groupBySettlement(snapshots);

  const selectedSettlement = manage
    ? settlements.find(
        (settlement) =>
          settlement.id === manage,
      )
    : undefined;

  const editingSettlement = edit
    ? settlements.find(
        (settlement) =>
          settlement.id === edit &&
          isEditable(settlement.status),
      )
    : undefined;

  const recognizedSettlements =
    settlements.filter(
      (settlement) =>
        settlement.status ===
          "approved" ||
        settlement.status === "paid",
    );

  const totalRecognizedGross =
    recognizedSettlements.reduce(
      (total, settlement) =>
        total +
        Number(settlement.gross_pay),
      0,
    );

  const totalPaidDeposits = settlements
    .filter(
      (settlement) =>
        settlement.status === "paid",
    )
    .reduce(
      (total, settlement) =>
        total +
        Number(
          settlement.net_deposit,
        ),
      0,
    );

  const reviewNeededCount =
    settlements.filter(
      (settlement) =>
        settlement.status ===
        "review_needed",
    ).length;

  const hasQueryError = Boolean(
    settlementsError ||
      lineItemsError ||
      adjustmentsError ||
      auditError ||
      snapshotsError ||
      loadsError ||
      expensesError,
  );

  const selectedLineItems =
    selectedSettlement
      ? lineItemsBySettlement.get(
          selectedSettlement.id,
        ) ?? []
      : [];

  const selectedLoadCount = new Set(
    selectedLineItems
      .map((lineItem) => lineItem.load_id)
      .filter(
        (loadId): loadId is string =>
          Boolean(loadId),
      ),
  ).size;

  const linkedExpenseIds = new Set(
    lineItems
      .map((lineItem) => lineItem.expense_id)
      .filter(
        (
          expenseId,
        ): expenseId is string =>
          Boolean(expenseId),
      ),
  );

  const selectedLinkedExpenseLines =
    selectedLineItems.filter(
      (lineItem) =>
        Boolean(lineItem.expense_id),
    );

  const linkedExpenseSourceTotal =
    selectedLinkedExpenseLines.reduce(
      (total, lineItem) =>
        total +
        Number(
          lineItem.source_amount ?? 0,
        ),
      0,
    );

  const linkedExpenseStatementTotal =
    selectedLinkedExpenseLines.reduce(
      (total, lineItem) =>
        total + Number(lineItem.amount),
      0,
    );

  const availableExpenses: ExpenseOption[] =
    expenseRecords
      .filter(
        (expense) =>
          !linkedExpenseIds.has(expense.id),
      )
      .sort((first, second) => {
        if (!selectedSettlement) {
          return second.expense_date.localeCompare(
            first.expense_date,
          );
        }

        const firstInPeriod =
          (!selectedSettlement.period_start_date ||
            first.expense_date >=
              selectedSettlement.period_start_date) &&
          (!selectedSettlement.period_end_date ||
            first.expense_date <=
              selectedSettlement.period_end_date);

        const secondInPeriod =
          (!selectedSettlement.period_start_date ||
            second.expense_date >=
              selectedSettlement.period_start_date) &&
          (!selectedSettlement.period_end_date ||
            second.expense_date <=
              selectedSettlement.period_end_date);

        if (firstInPeriod !== secondInPeriod) {
          return firstInPeriod ? -1 : 1;
        }

        return second.expense_date.localeCompare(
          first.expense_date,
        );
      })
      .map((expense) => {
        const linkedLoad = expense.load_id
          ? loadsById.get(expense.load_id)
          : undefined;

        return {
          ...expense,
          load_label: linkedLoad
            ? `Load ${linkedLoad.load_number} · ${linkedLoad.origin_city}, ${linkedLoad.origin_state} → ${linkedLoad.destination_city}, ${linkedLoad.destination_state}`
            : null,
        };
      });

  const selectedAdjustments =
    selectedSettlement
      ? adjustmentsBySettlement.get(
          selectedSettlement.id,
        ) ?? []
      : [];

  const selectedAudit = selectedSettlement
    ? auditBySettlement.get(
        selectedSettlement.id,
      ) ?? []
    : [];

  const selectedSnapshots =
    selectedSettlement
      ? snapshotsBySettlement.get(
          selectedSettlement.id,
        ) ?? []
      : [];

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
              Settlement lifecycle
            </p>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/fuel"
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-bold text-slate-200 transition hover:border-sky-400 hover:text-white sm:px-4"
            >
              Fuel
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
            Reviewable weekly pay
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Settlements
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Build each statement from earnings,
            deductions, reimbursements, linked
            loads, and recorded operating expenses.
            Review and approve it,
            preserve an immutable snapshot, then
            record later corrections through
            auditable adjustments.
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
            settlement workflow records.
          </div>
        ) : null}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Settlement records
            </p>
            <p className="mt-3 text-2xl font-black text-white">
              {formatNumber(
                settlements.length,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Awaiting review
            </p>
            <p className="mt-3 text-2xl font-black text-amber-400">
              {formatNumber(
                reviewNeededCount,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Approved gross pay
            </p>
            <p className="mt-3 text-2xl font-black text-white">
              {formatCurrency(
                totalRecognizedGross,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">
              Confirmed deposits
            </p>
            <p className="mt-3 text-2xl font-black text-emerald-400">
              {formatCurrency(
                totalPaidDeposits,
              )}
            </p>
          </article>
        </section>

        {manage &&
        !selectedSettlement ? (
          <div className="mt-8 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-200">
            That settlement could not be found.
          </div>
        ) : null}

        {selectedSettlement ? (
          <section
            id="settlement-workspace"
            className="mt-8 space-y-6"
          >
            <article className="rounded-2xl border border-sky-400/20 bg-slate-900/90 p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-black text-white">
                      {selectedSettlement.statement_number
                        ? `Statement ${selectedSettlement.statement_number}`
                        : selectedSettlement.carrier_or_company ??
                          "Settlement workspace"}
                    </h2>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${statusDetails[selectedSettlement.status].className}`}
                    >
                      {
                        statusDetails[
                          selectedSettlement
                            .status
                        ].label
                      }
                    </span>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {
                      statusDetails[
                        selectedSettlement.status
                      ].description
                    }
                  </p>

                  <p className="mt-3 text-sm font-semibold text-slate-300">
                    {formatDate(
                      selectedSettlement.settlement_date,
                    )}
                    {" · "}
                    {formatDate(
                      selectedSettlement.period_start_date,
                    )}
                    {" → "}
                    {formatDate(
                      selectedSettlement.period_end_date,
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isEditable(
                    selectedSettlement.status,
                  ) ? (
                    <Link
                      href={`/settlements?manage=${selectedSettlement.id}&edit=${selectedSettlement.id}#settlement-form`}
                      className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-4 py-2.5 text-sm font-bold text-sky-300 transition hover:bg-sky-400/20"
                    >
                      Edit metadata
                    </Link>
                  ) : null}

                  <DeleteSettlementForm
                    settlementId={
                      selectedSettlement.id
                    }
                    description={`settlement dated ${formatDate(
                      selectedSettlement.settlement_date,
                    )}`}
                    status={
                      selectedSettlement.status
                    }
                    className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-400/20"
                  />

                  <Link
                    href="/settlements#settlement-form"
                    className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:text-white"
                  >
                    Close workspace
                  </Link>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-slate-950/70 p-4">
                  <p className="text-xs text-slate-500">
                    Gross earnings
                  </p>
                  <p className="mt-1 text-lg font-black text-emerald-400">
                    {formatCurrency(
                      selectedSettlement.gross_pay,
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/70 p-4">
                  <p className="text-xs text-slate-500">
                    Deductions
                  </p>
                  <p className="mt-1 text-lg font-black text-amber-400">
                    {formatCurrency(
                      selectedSettlement.deductions,
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/70 p-4">
                  <p className="text-xs text-slate-500">
                    Reimbursements
                  </p>
                  <p className="mt-1 text-lg font-black text-sky-400">
                    {formatCurrency(
                      selectedSettlement.reimbursements,
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/70 p-4">
                  <p className="text-xs text-slate-500">
                    Net deposit
                  </p>
                  <p className="mt-1 text-lg font-black text-white">
                    {formatCurrency(
                      selectedSettlement.net_deposit,
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Lifecycle action
                </p>
                <div className="mt-4">
                  <LifecycleActions
                    settlementId={
                      selectedSettlement.id
                    }
                    status={
                      selectedSettlement.status
                    }
                  />
                </div>
              </div>
            </article>

            <div className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
              <article className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
                <div className="border-b border-slate-800 px-5 py-5 sm:px-6">
                  <p className="text-sm font-semibold text-sky-400">
                    Calculated statement
                  </p>
                  <h3 className="mt-1 text-xl font-black text-white">
                    Loads and statement lines
                  </h3>
                  <p className="mt-2 text-xs text-slate-500">
                    {formatNumber(
                      selectedLoadCount,
                    )}{" "}
                    {selectedLoadCount === 1
                      ? "load"
                      : "loads"}{" "}
                    represented by line items.
                  </p>
                </div>

                {selectedLineItems.length === 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-slate-500">
                    No line items recorded.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {selectedLineItems.map(
                      (lineItem) => {
                        const details =
                          lineItemDetails[
                            lineItem.kind
                          ];
                        const linkedLoad =
                          lineItem.load_id
                            ? loadsById.get(
                                lineItem.load_id,
                              )
                            : undefined;

                        return (
                          <section
                            key={lineItem.id}
                            className="p-5 sm:p-6"
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-3">
                                  <h4 className="font-black text-white">
                                    {
                                      lineItem.description
                                    }
                                  </h4>
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-xs font-bold ${details.className}`}
                                  >
                                    {details.label}
                                  </span>

                                  {lineItem.expense_id ? (
                                    <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-xs font-bold text-sky-300">
                                      Linked expense
                                    </span>
                                  ) : null}
                                </div>

                                <p className="mt-2 text-sm capitalize text-slate-400">
                                  {lineItem.category.replaceAll(
                                    "_",
                                    " ",
                                  )}
                                </p>

                                {lineItem.expense_id &&
                                lineItem.source_amount !== null ? (
                                  <div className="mt-3 rounded-lg border border-sky-400/15 bg-sky-400/5 px-3 py-2 text-xs leading-5 text-sky-100/80">
                                    Expense ledger amount:{" "}
                                    <strong>
                                      {formatCurrency(
                                        lineItem.source_amount,
                                      )}
                                    </strong>
                                    {" · "}
                                    Statement variance:{" "}
                                    <strong>
                                      {formatCurrency(
                                        Number(
                                          lineItem.amount,
                                        ) -
                                          Number(
                                            lineItem.source_amount,
                                          ),
                                      )}
                                    </strong>
                                    {lineItem.variance_reason ? (
                                      <>
                                        {" · "}
                                        {lineItem.variance_reason}
                                      </>
                                    ) : null}
                                  </div>
                                ) : null}

                                {linkedLoad ? (
                                  <p className="mt-2 text-xs text-slate-500">
                                    Load{" "}
                                    <strong className="text-slate-300">
                                      {
                                        linkedLoad.load_number
                                      }
                                    </strong>
                                    {" · "}
                                    {
                                      linkedLoad.origin_city
                                    }
                                    ,{" "}
                                    {
                                      linkedLoad.origin_state
                                    }
                                    {" → "}
                                    {
                                      linkedLoad.destination_city
                                    }
                                    ,{" "}
                                    {
                                      linkedLoad.destination_state
                                    }
                                  </p>
                                ) : null}

                                {lineItem.authorization_reference ? (
                                  <p className="mt-2 text-xs text-slate-500">
                                    Authorization:{" "}
                                    {
                                      lineItem.authorization_reference
                                    }
                                  </p>
                                ) : null}

                                {lineItem.balance_after !== null ? (
                                  <p className="mt-1 text-xs text-slate-500">
                                    Balance after:{" "}
                                    {formatCurrency(
                                      lineItem.balance_after,
                                    )}
                                  </p>
                                ) : null}
                              </div>

                              <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                                <p
                                  className={`text-lg font-black ${details.amountClassName}`}
                                >
                                  {details.sign}
                                  {formatCurrency(
                                    lineItem.amount,
                                  )}
                                </p>

                                {isEditable(
                                  selectedSettlement.status,
                                ) ? (
                                  lineItem.expense_id ? (
                                    <UnlinkExpenseForm
                                      settlementId={
                                        selectedSettlement.id
                                      }
                                      lineItemId={
                                        lineItem.id
                                      }
                                      description={
                                        lineItem.description
                                      }
                                    />
                                  ) : (
                                    <DeleteLineItemForm
                                      settlementId={
                                        selectedSettlement.id
                                      }
                                      lineItemId={
                                        lineItem.id
                                      }
                                      description={
                                        lineItem.description
                                      }
                                    />
                                  )
                                ) : null}
                              </div>
                            </div>
                          </section>
                        );
                      },
                    )}
                  </div>
                )}

                {isEditable(
                  selectedSettlement.status,
                ) ? (
                  <div className="border-t border-slate-800 p-5 sm:p-6">
                    <p className="text-sm font-bold text-white">
                      Add a load or statement line
                    </p>
                    <LineItemForm
                      settlementId={
                        selectedSettlement.id
                      }
                      loads={loads}
                      resetKey={saved}
                    />
                  </div>
                ) : null}
              </article>

              <div className="space-y-6">
                <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
                  <p className="text-sm font-semibold text-sky-400">
                    Reuse recorded costs
                  </p>

                  <h3 className="mt-1 text-xl font-black text-white">
                    Operating expense reconciliation
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Link expenses already recorded in
                    Axleledger instead of retyping
                    them as settlement deductions.
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-950/60 p-4">
                      <p className="text-xs text-slate-500">
                        Linked ledger costs
                      </p>

                      <p className="mt-1 font-black text-white">
                        {formatCurrency(
                          linkedExpenseSourceTotal,
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-950/60 p-4">
                      <p className="text-xs text-slate-500">
                        Statement deductions
                      </p>

                      <p className="mt-1 font-black text-amber-400">
                        {formatCurrency(
                          linkedExpenseStatementTotal,
                        )}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {formatNumber(
                      selectedLinkedExpenseLines.length,
                    )}{" "}
                    linked{" "}
                    {selectedLinkedExpenseLines.length ===
                    1
                      ? "expense"
                      : "expenses"}
                    . The original expense records
                    remain unchanged.
                  </p>

                  {isEditable(
                    selectedSettlement.status,
                  ) ? (
                    <ExpenseReconciliationForm
                      settlementId={
                        selectedSettlement.id
                      }
                      expenses={
                        availableExpenses
                      }
                    />
                  ) : (
                    <p className="mt-5 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-xs leading-5 text-slate-500">
                      Reopen the settlement to link
                      or unlink operating expenses.
                    </p>
                  )}
                </article>

                <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
                  <p className="text-sm font-semibold text-amber-400">
                    Post-approval corrections
                  </p>
                  <h3 className="mt-1 text-xl font-black text-white">
                    Adjustments
                  </h3>

                  <div className="mt-5 space-y-3">
                    {selectedAdjustments.length ===
                    0 ? (
                      <p className="text-sm text-slate-500">
                        No adjustments recorded.
                      </p>
                    ) : (
                      selectedAdjustments.map(
                        (adjustment) => (
                          <div
                            key={adjustment.id}
                            className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-300">
                                {adjustment.reason}
                              </p>
                              <p
                                className={
                                  Number(
                                    adjustment.amount,
                                  ) >= 0
                                    ? "font-black text-emerald-400"
                                    : "font-black text-red-400"
                                }
                              >
                                {Number(
                                  adjustment.amount,
                                ) >= 0
                                  ? "+"
                                  : "−"}
                                {formatCurrency(
                                  Math.abs(
                                    Number(
                                      adjustment.amount,
                                    ),
                                  ),
                                )}
                              </p>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              {formatDateTime(
                                adjustment.created_at,
                              )}
                            </p>
                          </div>
                        ),
                      )
                    )}
                  </div>

                  {selectedSettlement.status ===
                    "approved" ||
                  selectedSettlement.status ===
                    "paid" ? (
                    <AdjustmentForm
                      settlementId={
                        selectedSettlement.id
                      }
                    />
                  ) : (
                    <p className="mt-4 text-xs leading-5 text-slate-500">
                      Draft corrections belong in
                      line items. Signed adjustments
                      become available after approval.
                    </p>
                  )}
                </article>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
                <p className="text-sm font-semibold text-sky-400">
                  Approval history
                </p>
                <h3 className="mt-1 text-xl font-black text-white">
                  Preserved snapshots
                </h3>

                {selectedSnapshots.length ===
                0 ? (
                  <p className="mt-5 text-sm text-slate-500">
                    No approval snapshot yet.
                  </p>
                ) : (
                  <div className="mt-5 space-y-3">
                    {selectedSnapshots.map(
                      (snapshot) => (
                        <div
                          key={snapshot.id}
                          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                        >
                          <p className="font-bold text-white">
                            Approval version{" "}
                            {
                              snapshot.approval_version
                            }
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDateTime(
                              snapshot.created_at,
                            )}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </article>

              <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
                <p className="text-sm font-semibold text-sky-400">
                  Audit trail
                </p>
                <h3 className="mt-1 text-xl font-black text-white">
                  Recent lifecycle events
                </h3>

                {selectedAudit.length === 0 ? (
                  <p className="mt-5 text-sm text-slate-500">
                    No audit events recorded.
                  </p>
                ) : (
                  <div className="mt-5 space-y-3">
                    {selectedAudit
                      .slice(0, 12)
                      .map((audit) => {
                        const detail =
                          auditDetail(audit);

                        return (
                          <div
                            key={audit.id}
                            className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                          >
                            <p className="font-bold capitalize text-white">
                              {audit.event_type.replaceAll(
                                "_",
                                " ",
                              )}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {audit.from_status ??
                                "New"}
                              {" → "}
                              {audit.to_status ??
                                "No status change"}
                            </p>
                            {detail ? (
                              <p className="mt-2 text-sm text-slate-300">
                                {detail}
                              </p>
                            ) : null}
                            <p className="mt-2 text-xs text-slate-600">
                              {formatDateTime(
                                audit.created_at,
                              )}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                )}
              </article>
            </div>

            {selectedSettlement.notes ? (
              <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Settlement notes
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                  {selectedSettlement.notes}
                </p>
              </article>
            ) : null}
          </section>
        ) : null}

        <section className="mt-8 grid items-start gap-6 xl:grid-cols-[0.85fr_1.45fr]">
          <SettlementForm
            editingSettlement={
              editingSettlement
            }
            resetKey={saved}
            editRequested={Boolean(edit)}
            defaultDate={getDefaultDate()}
          />

          <article className="self-start overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
            <div className="border-b border-slate-800 px-5 py-5 sm:px-6">
              <p className="text-sm font-semibold text-sky-400">
                Workflow records
              </p>
              <h2 className="mt-1 text-2xl font-black text-white">
                Settlement history
              </h2>
            </div>

            {settlements.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-xl font-black text-slate-400">
                  0
                </div>
                <p className="mt-4 font-bold text-white">
                  No settlements recorded
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Create a draft settlement, add
                  its line items, and move it
                  through review and approval.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {settlements.map(
                  (settlement) => {
                    const status =
                      statusDetails[
                        settlement.status
                      ];
                    const recordLineItems =
                      lineItemsBySettlement.get(
                        settlement.id,
                      ) ?? [];
                    const snapshotCount =
                      snapshotsBySettlement.get(
                        settlement.id,
                      )?.length ?? 0;

                    const loadCount = new Set(
                      recordLineItems
                        .map(
                          (lineItem) =>
                            lineItem.load_id,
                        )
                        .filter(
                          (loadId): loadId is string =>
                            Boolean(loadId),
                        ),
                    ).size;

                    return (
                      <section
                        key={settlement.id}
                        className="p-5 sm:p-6"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="text-lg font-black text-white">
                                {settlement.statement_number
                                  ? `Statement ${settlement.statement_number}`
                                  : settlement.carrier_or_company ??
                                    "Settlement"}
                              </h3>
                              <span
                                className={`rounded-full border px-2.5 py-1 text-xs font-bold ${status.className}`}
                              >
                                {status.label}
                              </span>
                            </div>

                            <p className="mt-2 text-sm font-semibold text-slate-300">
                              {formatDate(
                                settlement.settlement_date,
                              )}
                            </p>

                            <p className="mt-2 text-xs text-slate-500">
                              {formatNumber(
                                recordLineItems.length,
                              )}{" "}
                              line items ·{" "}
                              {formatNumber(
                                loadCount,
                              )}{" "}
                              {loadCount === 1
                                ? "load"
                                : "loads"}{" "}
                              ·{" "}
                              {formatNumber(
                                snapshotCount,
                              )}{" "}
                              approval snapshots
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                            <div className="text-right">
                              <p className="text-xs text-slate-500">
                                Net deposit
                              </p>
                              <p className="mt-1 text-lg font-black text-white">
                                {formatCurrency(
                                  settlement.net_deposit,
                                )}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/settlements?manage=${settlement.id}#settlement-workspace`}
                                className="rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-bold text-sky-300 transition hover:bg-sky-400/20"
                              >
                                Manage
                              </Link>

                              {isEditable(
                                settlement.status,
                              ) ? (
                                <Link
                                  href={`/settlements?manage=${settlement.id}&edit=${settlement.id}#settlement-form`}
                                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-300 transition hover:text-white"
                                >
                                  Edit
                                </Link>
                              ) : null}

                              <DeleteSettlementForm
                                settlementId={
                                  settlement.id
                                }
                                description={`settlement dated ${formatDate(
                                  settlement.settlement_date,
                                )}`}
                                status={
                                  settlement.status
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl bg-slate-950/60 p-3">
                            <p className="text-xs text-slate-500">
                              Gross
                            </p>
                            <p className="mt-1 font-bold text-emerald-400">
                              {formatCurrency(
                                settlement.gross_pay,
                              )}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-950/60 p-3">
                            <p className="text-xs text-slate-500">
                              Deductions
                            </p>
                            <p className="mt-1 font-bold text-amber-400">
                              {formatCurrency(
                                settlement.deductions,
                              )}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-950/60 p-3">
                            <p className="text-xs text-slate-500">
                              Reimbursements
                            </p>
                            <p className="mt-1 font-bold text-sky-400">
                              {formatCurrency(
                                settlement.reimbursements,
                              )}
                            </p>
                          </div>
                        </div>
                      </section>
                    );
                  },
                )}
              </div>
            )}
          </article>
        </section>

        <div className="mt-6 rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3 text-xs leading-5 text-sky-100/80">
          Draft and reopened records are editable.
          Review locks the statement. Approval
          stores a versioned snapshot, and later
          corrections are preserved as signed
          adjustments or a documented reopen.
        </div>
      </div>
    </main>
  );
}
