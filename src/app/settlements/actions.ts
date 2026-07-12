"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type SettlementValues = {
  settlement_date: string;
  carrier_or_company: string | null;
  gross_pay: number;
  deductions: number;
  reimbursements: number;
  net_deposit: number;
  notes: string | null;
};

function readText(
  formData: FormData,
  fieldName: string,
) {
  const value = formData.get(fieldName);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function redirectWithError(
  message: string,
  editId?: string,
): never {
  const params = new URLSearchParams({
    error: message,
  });

  if (editId) {
    params.set("edit", editId);
  }

  redirect(
    `/settlements?${params.toString()}#settlement-form`,
  );
}

function redirectWithSuccess(
  message: string,
): never {
  const params = new URLSearchParams({
    success: message,
    saved: Date.now().toString(),
  });

  redirect(
    `/settlements?${params.toString()}`,
  );
}

function requireText(
  formData: FormData,
  fieldName: string,
  displayName: string,
  editId?: string,
) {
  const value = readText(
    formData,
    fieldName,
  );

  if (!value) {
    redirectWithError(
      `${displayName} is required.`,
      editId,
    );
  }

  return value;
}

function readNonnegativeNumber(
  formData: FormData,
  fieldName: string,
  displayName: string,
  editId?: string,
) {
  const rawValue = requireText(
    formData,
    fieldName,
    displayName,
    editId,
  );

  const value = Number(rawValue);

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    redirectWithError(
      `${displayName} must be zero or greater.`,
      editId,
    );
  }

  return value;
}

function validateDate(
  value: string,
  displayName: string,
  editId?: string,
) {
  const datePattern =
    /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(value)) {
    redirectWithError(
      `${displayName} must be a valid date.`,
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
      editId,
    );
  }

  return value;
}

function readSettlementValues(
  formData: FormData,
  editId?: string,
): SettlementValues {
  const settlementDate = validateDate(
    requireText(
      formData,
      "settlement_date",
      "Settlement date",
      editId,
    ),
    "Settlement date",
    editId,
  );

  return {
    settlement_date: settlementDate,
    carrier_or_company:
      readText(
        formData,
        "carrier_or_company",
      ) || null,
    gross_pay: readNonnegativeNumber(
      formData,
      "gross_pay",
      "Gross pay",
      editId,
    ),
    deductions: readNonnegativeNumber(
      formData,
      "deductions",
      "Deductions",
      editId,
    ),
    reimbursements:
      readNonnegativeNumber(
        formData,
        "reimbursements",
        "Reimbursements",
        editId,
      ),
    net_deposit: readNonnegativeNumber(
      formData,
      "net_deposit",
      "Net deposit",
      editId,
    ),
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

function revalidateSettlementPages() {
  revalidatePath("/settlements");
  revalidatePath("/");
}

export async function createSettlement(
  formData: FormData,
) {
  const values =
    readSettlementValues(formData);

  const { supabase, userId } =
    await getAuthenticatedClient();

  const { error } = await supabase
    .from("settlements")
    .insert({
      user_id: userId,
      ...values,
    });

  if (error) {
    console.error(
      "Unable to create settlement:",
      error,
    );

    redirectWithError(
      "Axleledger could not save the settlement.",
    );
  }

  revalidateSettlementPages();

  redirectWithSuccess(
    "Settlement added successfully.",
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
    console.error(
      "Unable to update settlement:",
      error,
    );

    redirectWithError(
      "Axleledger could not update the settlement.",
      settlementId,
    );
  }

  revalidateSettlementPages();

  redirectWithSuccess(
    "Settlement updated successfully.",
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

  const { supabase, userId } =
    await getAuthenticatedClient();

  const {
    data: deletedSettlement,
    error,
  } = await supabase
    .from("settlements")
    .delete()
    .eq("id", settlementId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error || !deletedSettlement) {
    console.error(
      "Unable to delete settlement:",
      error,
    );

    redirectWithError(
      "Axleledger could not delete the settlement.",
    );
  }

  revalidateSettlementPages();

  redirectWithSuccess(
    "Settlement deleted.",
  );
}
