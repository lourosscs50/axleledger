"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import type {
  SettlementLineItemKind,
} from "./types";

type SettlementValues = {
  statement_number: string | null;
  settlement_date: string;
  period_start_date: string | null;
  period_end_date: string | null;
  carrier_or_company: string | null;
  notes: string | null;
};

const lineItemKinds = [
  "earning",
  "deduction",
  "reimbursement",
] as const;

const allowedLineItemKinds =
  new Set<string>(lineItemKinds);

function readText(
  formData: FormData,
  fieldName: string,
) {
  const value = formData.get(fieldName);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function buildSettlementUrl({
  error,
  success,
  manageId,
  editId,
  anchor = "settlement-workspace",
}: {
  error?: string;
  success?: string;
  manageId?: string;
  editId?: string;
  anchor?: string;
}) {
  const params = new URLSearchParams();

  if (error) {
    params.set("error", error);
  }

  if (success) {
    params.set("success", success);
    params.set("saved", Date.now().toString());
  }

  if (manageId) {
    params.set("manage", manageId);
  }

  if (editId) {
    params.set("edit", editId);
  }

  const query = params.toString();

  return `/settlements${
    query ? `?${query}` : ""
  }${anchor ? `#${anchor}` : ""}`;
}

function redirectWithError(
  message: string,
  manageId?: string,
  editId?: string,
): never {
  redirect(
    buildSettlementUrl({
      error: message,
      manageId,
      editId,
    }),
  );
}

function redirectWithSuccess(
  message: string,
  manageId?: string,
  anchor = "settlement-workspace",
): never {
  redirect(
    buildSettlementUrl({
      success: message,
      manageId,
      anchor,
    }),
  );
}

function requireText(
  formData: FormData,
  fieldName: string,
  displayName: string,
  manageId?: string,
  editId?: string,
) {
  const value = readText(
    formData,
    fieldName,
  );

  if (!value) {
    redirectWithError(
      `${displayName} is required.`,
      manageId,
      editId,
    );
  }

  return value;
}

function validateDate(
  value: string,
  displayName: string,
  manageId?: string,
  editId?: string,
) {
  const datePattern =
    /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(value)) {
    redirectWithError(
      `${displayName} must be a valid date.`,
      manageId,
      editId,
    );
  }

  const parsedDate = new Date(
    `${value}T00:00:00Z`,
  );

  const normalizedDate =
    Number.isNaN(parsedDate.getTime())
      ? ""
      : parsedDate
          .toISOString()
          .slice(0, 10);

  if (normalizedDate !== value) {
    redirectWithError(
      `${displayName} must be a valid date.`,
      manageId,
      editId,
    );
  }

  return value;
}

function readOptionalDate(
  formData: FormData,
  fieldName: string,
  displayName: string,
  manageId?: string,
  editId?: string,
) {
  const value = readText(
    formData,
    fieldName,
  );

  return value
    ? validateDate(
        value,
        displayName,
        manageId,
        editId,
      )
    : null;
}

function readPositiveNumber(
  formData: FormData,
  fieldName: string,
  displayName: string,
  manageId?: string,
) {
  const rawValue = requireText(
    formData,
    fieldName,
    displayName,
    manageId,
  );

  const value = Number(rawValue);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    redirectWithError(
      `${displayName} must be greater than zero.`,
      manageId,
    );
  }

  return value;
}

function readOptionalNonnegativeNumber(
  formData: FormData,
  fieldName: string,
  displayName: string,
  manageId?: string,
) {
  const rawValue = readText(
    formData,
    fieldName,
  );

  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue);

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    redirectWithError(
      `${displayName} must be zero or greater.`,
      manageId,
    );
  }

  return value;
}

function readSignedNonzeroNumber(
  formData: FormData,
  fieldName: string,
  displayName: string,
  manageId: string,
) {
  const rawValue = requireText(
    formData,
    fieldName,
    displayName,
    manageId,
  );

  const value = Number(rawValue);

  if (
    !Number.isFinite(value) ||
    value === 0
  ) {
    redirectWithError(
      `${displayName} must be a non-zero amount.`,
      manageId,
    );
  }

  return value;
}

function readSettlementValues(
  formData: FormData,
  manageId?: string,
  editId?: string,
): SettlementValues {
  const settlementDate = validateDate(
    requireText(
      formData,
      "settlement_date",
      "Settlement date",
      manageId,
      editId,
    ),
    "Settlement date",
    manageId,
    editId,
  );

  const periodStartDate =
    readOptionalDate(
      formData,
      "period_start_date",
      "Period start date",
      manageId,
      editId,
    );

  const periodEndDate =
    readOptionalDate(
      formData,
      "period_end_date",
      "Period end date",
      manageId,
      editId,
    );

  if (
    periodStartDate &&
    periodEndDate &&
    periodEndDate < periodStartDate
  ) {
    redirectWithError(
      "Period end date cannot be before the start date.",
      manageId,
      editId,
    );
  }

  return {
    statement_number:
      readText(
        formData,
        "statement_number",
      ) || null,
    settlement_date: settlementDate,
    period_start_date: periodStartDate,
    period_end_date: periodEndDate,
    carrier_or_company:
      readText(
        formData,
        "carrier_or_company",
      ) || null,
    notes:
      readText(formData, "notes") ||
      null,
  };
}

async function getAuthenticatedClient() {
  const supabase = await createClient();

  const { data, error } =
    await supabase.auth.getClaims();

  const userId =
    typeof data?.claims?.sub === "string"
      ? data.claims.sub
      : null;

  if (error || !userId) {
    redirect("/login");
  }

  return {
    supabase,
    userId,
  };
}

async function validateLinkedLoad(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  userId: string,
  loadId: string | null,
  settlementId: string,
) {
  if (!loadId) {
    return;
  }

  const {
    data: linkedLoad,
    error,
  } = await supabase
    .from("loads")
    .select("id")
    .eq("id", loadId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !linkedLoad) {
    redirectWithError(
      "Select a valid load.",
      settlementId,
    );
  }
}

function revalidateSettlementPages() {
  revalidatePath("/settlements");
  revalidatePath("/");
}

function handleActionError(
  label: string,
  error: unknown,
  settlementId?: string,
): never {
  console.error(label, error);

  redirectWithError(
    "Axleledger could not complete that settlement action.",
    settlementId,
  );
}

export async function createSettlement(
  formData: FormData,
) {
  const values =
    readSettlementValues(formData);

  const { supabase, userId } =
    await getAuthenticatedClient();

  const {
    data: createdSettlement,
    error,
  } = await supabase
    .from("settlements")
    .insert({
      user_id: userId,
      ...values,
      gross_pay: 0,
      deductions: 0,
      reimbursements: 0,
      net_deposit: 0,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !createdSettlement) {
    handleActionError(
      "Unable to create settlement:",
      error,
    );
  }

  revalidateSettlementPages();

  redirectWithSuccess(
    "Draft settlement created. Add its line items next.",
    createdSettlement.id,
  );
}

export async function updateSettlement(
  formData: FormData,
) {
  const settlementId = requireText(
    formData,
    "settlement_id",
    "Settlement ID",
  );

  const values = readSettlementValues(
    formData,
    settlementId,
    settlementId,
  );

  const { supabase, userId } =
    await getAuthenticatedClient();

  const {
    data: updatedSettlement,
    error,
  } = await supabase
    .from("settlements")
    .update(values)
    .eq("id", settlementId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error || !updatedSettlement) {
    handleActionError(
      "Unable to update settlement:",
      error,
      settlementId,
    );
  }

  revalidateSettlementPages();

  redirectWithSuccess(
    "Settlement details updated.",
    settlementId,
  );
}

export async function deleteSettlement(
  formData: FormData,
) {
  const settlementId = requireText(
    formData,
    "settlement_id",
    "Settlement ID",
  );

  const { supabase } =
    await getAuthenticatedClient();

  const { error } = await supabase.rpc(
    "delete_settlement",
    {
      p_settlement_id: settlementId,
    },
  );

  if (error) {
    handleActionError(
      "Unable to delete settlement:",
      error,
      settlementId,
    );
  }

  revalidateSettlementPages();

  redirectWithSuccess(
    "Settlement deleted.",
    undefined,
    "settlement-form",
  );
}

export async function addSettlementLineItem(
  formData: FormData,
) {
  const settlementId = requireText(
    formData,
    "settlement_id",
    "Settlement ID",
  );

  const kindValue = requireText(
    formData,
    "kind",
    "Line-item type",
    settlementId,
  );

  if (
    !allowedLineItemKinds.has(
      kindValue,
    )
  ) {
    redirectWithError(
      "Select a valid line-item type.",
      settlementId,
    );
  }

  const kind =
    kindValue as SettlementLineItemKind;

  const rawCategory = requireText(
    formData,
    "category",
    "Category",
    settlementId,
  ).toLowerCase().replaceAll(" ", "_");

  const category =
    kind === "earning" &&
    new Set([
      "linehaul",
      "line_haul",
      "load_pay",
      "load_revenue",
    ]).has(rawCategory)
      ? "load_revenue"
      : rawCategory;

  const loadId =
    readText(formData, "load_id") ||
    null;

  if (
    kind === "earning" &&
    category === "load_revenue" &&
    !loadId
  ) {
    redirectWithError(
      "Select the load represented by this load-revenue line.",
      settlementId,
    );
  }

  const authorizationReference =
    kind === "deduction"
      ? readText(
          formData,
          "authorization_reference",
        ) || null
      : null;

  const balanceAfter =
    kind === "deduction"
      ? readOptionalNonnegativeNumber(
          formData,
          "balance_after",
          "Balance after",
          settlementId,
        )
      : null;

  const { supabase, userId } =
    await getAuthenticatedClient();

  await validateLinkedLoad(
    supabase,
    userId,
    loadId,
    settlementId,
  );

  const { error } = await supabase
    .from("settlement_line_items")
    .insert({
      user_id: userId,
      settlement_id: settlementId,
      load_id: loadId,
      kind,
      category,
      description: requireText(
        formData,
        "description",
        "Description",
        settlementId,
      ),
      amount: readPositiveNumber(
        formData,
        "amount",
        "Amount",
        settlementId,
      ),
      authorization_reference:
        authorizationReference,
      balance_after: balanceAfter,
    });

  if (error) {
    console.error(
      "Unable to add settlement line item:",
      error,
    );

    redirectWithError(
      error.code === "23505"
        ? "That load already has a primary load-revenue line on this settlement. Add accessorial pay under a different category."
        : error.message.includes(
              "Load revenue requires",
            )
          ? error.message
          : "Axleledger could not add that settlement line.",
      settlementId,
    );
  }

  revalidateSettlementPages();

  redirectWithSuccess(
    "Settlement line item added.",
    settlementId,
  );
}

export async function linkSettlementExpenses(
  formData: FormData,
) {
  const settlementId = requireText(
    formData,
    "settlement_id",
    "Settlement ID",
  );

  const expenseIds = Array.from(
    new Set(
      formData
        .getAll("expense_id")
        .filter(
          (value): value is string =>
            typeof value === "string" &&
            Boolean(value.trim()),
        )
        .map((value) => value.trim()),
    ),
  );

  if (expenseIds.length === 0) {
    redirectWithError(
      "Select at least one operating expense.",
      settlementId,
    );
  }

  const links = expenseIds.map(
    (expenseId) => ({
      expense_id: expenseId,
      statement_amount:
        readPositiveNumber(
          formData,
          `statement_amount_${expenseId}`,
          "Statement deduction",
          settlementId,
        ),
      variance_reason:
        readText(
          formData,
          `variance_reason_${expenseId}`,
        ) || null,
    }),
  );

  const { supabase } =
    await getAuthenticatedClient();

  const { error } = await supabase.rpc(
    "link_settlement_expenses",
    {
      p_settlement_id: settlementId,
      p_links: links,
    },
  );

  if (error) {
    console.error(
      "Unable to link settlement expenses:",
      error,
    );

    redirectWithError(
      error.message.includes(
        "already linked",
      )
        ? error.message
        : error.message.includes(
              "variance reason",
            )
          ? error.message
          : error.message.includes(
                "draft or reopened",
              )
            ? error.message
            : "Axleledger could not link those operating expenses.",
      settlementId,
    );
  }

  revalidatePath("/expenses");
  revalidateSettlementPages();

  redirectWithSuccess(
    expenseIds.length === 1
      ? "Operating expense linked to the settlement."
      : `${expenseIds.length} operating expenses linked to the settlement.`,
    settlementId,
  );
}

export async function unlinkSettlementExpense(
  formData: FormData,
) {
  const settlementId = requireText(
    formData,
    "settlement_id",
    "Settlement ID",
  );

  const lineItemId = requireText(
    formData,
    "line_item_id",
    "Line-item ID",
    settlementId,
  );

  const { supabase } =
    await getAuthenticatedClient();

  const { error } = await supabase.rpc(
    "unlink_settlement_expense",
    {
      p_settlement_id: settlementId,
      p_line_item_id: lineItemId,
    },
  );

  if (error) {
    console.error(
      "Unable to unlink settlement expense:",
      error,
    );

    redirectWithError(
      error.message.includes(
        "draft or reopened",
      )
        ? error.message
        : "Axleledger could not unlink that operating expense.",
      settlementId,
    );
  }

  revalidatePath("/expenses");
  revalidateSettlementPages();

  redirectWithSuccess(
    "Operating expense unlinked. The original expense remains recorded.",
    settlementId,
  );
}

export async function linkSettlementFixedCosts(
  formData: FormData,
) {
  const settlementId = requireText(
    formData,
    "settlement_id",
    "Settlement ID",
  );

  const fixedCostIds = Array.from(
    new Set(
      formData
        .getAll("fixed_cost_id")
        .filter(
          (value): value is string =>
            typeof value === "string" &&
            Boolean(value.trim()),
        )
        .map((value) => value.trim()),
    ),
  );

  if (fixedCostIds.length === 0) {
    redirectWithError(
      "Select at least one recurring fixed cost.",
      settlementId,
    );
  }

  const links = fixedCostIds.map(
    (fixedCostId) => ({
      fixed_cost_id: fixedCostId,
    }),
  );

  const { supabase } =
    await getAuthenticatedClient();

  const { error } = await supabase.rpc(
    "link_settlement_fixed_costs",
    {
      p_settlement_id: settlementId,
      p_links: links,
    },
  );

  if (error) {
    console.error(
      "Unable to link settlement fixed costs:",
      error,
    );

    redirectWithError(
      error.message.includes(
        "already linked",
      )
        ? error.message
        : error.message.includes(
              "draft or reopened",
            )
          ? error.message
          : error.message.includes(
                "negative net",
              )
            ? "This fixed cost would create a negative settlement balance. Apply the signed-settlement-balance migration, then try again."
            : "Axleledger could not link those recurring fixed costs.",
      settlementId,
    );
  }

  revalidatePath("/fixed-costs");
  revalidateSettlementPages();

  redirectWithSuccess(
    fixedCostIds.length === 1
      ? "Recurring fixed cost linked to the settlement."
      : `${fixedCostIds.length} recurring fixed costs linked to the settlement.`,
    settlementId,
  );
}

export async function unlinkSettlementFixedCost(
  formData: FormData,
) {
  const settlementId = requireText(
    formData,
    "settlement_id",
    "Settlement ID",
  );

  const lineItemId = requireText(
    formData,
    "line_item_id",
    "Line-item ID",
    settlementId,
  );

  const { supabase } =
    await getAuthenticatedClient();

  const { error } = await supabase.rpc(
    "unlink_settlement_fixed_cost",
    {
      p_settlement_id: settlementId,
      p_line_item_id: lineItemId,
    },
  );

  if (error) {
    console.error(
      "Unable to unlink settlement fixed cost:",
      error,
    );

    redirectWithError(
      error.message.includes(
        "draft or reopened",
      )
        ? error.message
        : "Axleledger could not unlink that recurring fixed cost.",
      settlementId,
    );
  }

  revalidatePath("/fixed-costs");
  revalidateSettlementPages();

  redirectWithSuccess(
    "Recurring fixed cost unlinked. The fixed-cost schedule remains recorded.",
    settlementId,
  );
}

export async function deleteSettlementLineItem(
  formData: FormData,
) {
  const settlementId = requireText(
    formData,
    "settlement_id",
    "Settlement ID",
  );

  const lineItemId = requireText(
    formData,
    "line_item_id",
    "Line-item ID",
    settlementId,
  );

  const { supabase, userId } =
    await getAuthenticatedClient();

  const {
    data: deletedLineItem,
    error,
  } = await supabase
    .from("settlement_line_items")
    .delete()
    .eq("id", lineItemId)
    .eq("settlement_id", settlementId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error || !deletedLineItem) {
    handleActionError(
      "Unable to delete settlement line item:",
      error,
      settlementId,
    );
  }

  revalidateSettlementPages();

  redirectWithSuccess(
    "Settlement line item deleted.",
    settlementId,
  );
}

async function runLifecycleRpc(
  functionName: string,
  settlementId: string,
  args: Record<string, unknown>,
  successMessage: string,
) {
  const { supabase } =
    await getAuthenticatedClient();

  const { error } = await supabase.rpc(
    functionName,
    {
      p_settlement_id: settlementId,
      ...args,
    },
  );

  if (error) {
    handleActionError(
      `Unable to run ${functionName}:`,
      error,
      settlementId,
    );
  }

  revalidateSettlementPages();

  redirectWithSuccess(
    successMessage,
    settlementId,
  );
}

export async function submitSettlementForReview(
  formData: FormData,
) {
  const settlementId = requireText(
    formData,
    "settlement_id",
    "Settlement ID",
  );

  await runLifecycleRpc(
    "submit_settlement_for_review",
    settlementId,
    {},
    "Settlement submitted for review.",
  );
}

export async function returnSettlementToDraft(
  formData: FormData,
) {
  const settlementId = requireText(
    formData,
    "settlement_id",
    "Settlement ID",
  );

  const reason = requireText(
    formData,
    "reason",
    "Return reason",
    settlementId,
  );

  await runLifecycleRpc(
    "return_settlement_to_draft",
    settlementId,
    {
      p_reason: reason,
    },
    "Settlement returned to draft.",
  );
}

export async function approveSettlement(
  formData: FormData,
) {
  const settlementId = requireText(
    formData,
    "settlement_id",
    "Settlement ID",
  );

  await runLifecycleRpc(
    "approve_settlement",
    settlementId,
    {},
    "Settlement approved and snapshotted.",
  );
}

export async function markSettlementPaid(
  formData: FormData,
) {
  const settlementId = requireText(
    formData,
    "settlement_id",
    "Settlement ID",
  );

  await runLifecycleRpc(
    "mark_settlement_paid",
    settlementId,
    {},
    "Settlement marked paid.",
  );
}

export async function reopenSettlement(
  formData: FormData,
) {
  const settlementId = requireText(
    formData,
    "settlement_id",
    "Settlement ID",
  );

  const reason = requireText(
    formData,
    "reason",
    "Reopen reason",
    settlementId,
  );

  await runLifecycleRpc(
    "reopen_settlement",
    settlementId,
    {
      p_reason: reason,
    },
    "Settlement reopened for correction.",
  );
}

export async function addSettlementAdjustment(
  formData: FormData,
) {
  const settlementId = requireText(
    formData,
    "settlement_id",
    "Settlement ID",
  );

  const amount = readSignedNonzeroNumber(
    formData,
    "amount",
    "Adjustment amount",
    settlementId,
  );

  const reason = requireText(
    formData,
    "reason",
    "Adjustment reason",
    settlementId,
  );

  await runLifecycleRpc(
    "add_settlement_adjustment",
    settlementId,
    {
      p_amount: amount,
      p_reason: reason,
    },
    "Settlement adjustment recorded.",
  );
}
