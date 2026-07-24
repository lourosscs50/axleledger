"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const categories = [
  "truck_payment",
  "trailer_lease",
  "insurance",
  "permits",
  "communications",
  "subscriptions",
  "other",
] as const;

const frequencies = [
  "weekly",
  "monthly",
] as const;

type FixedCostCategory =
  (typeof categories)[number];

type FixedCostFrequency =
  (typeof frequencies)[number];

type FixedCostValues = {
  name: string;
  category: FixedCostCategory;
  amount: number;
  frequency: FixedCostFrequency;
  effective_date: string;
  is_active: boolean;
  notes: string | null;
};

const allowedCategories =
  new Set<string>(categories);

const allowedFrequencies =
  new Set<string>(frequencies);

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
    `/fixed-costs?${params.toString()}#fixed-cost-form`,
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
    `/fixed-costs?${params.toString()}`,
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

function readPositiveNumber(
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
    value <= 0
  ) {
    redirectWithError(
      `${displayName} must be greater than zero.`,
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

function readFixedCostValues(
  formData: FormData,
  editId?: string,
): FixedCostValues {
  const categoryValue = requireText(
    formData,
    "category",
    "Category",
    editId,
  );

  if (
    !allowedCategories.has(
      categoryValue,
    )
  ) {
    redirectWithError(
      "Select a valid fixed-cost category.",
      editId,
    );
  }

  const frequencyValue = requireText(
    formData,
    "frequency",
    "Frequency",
    editId,
  );

  if (
    !allowedFrequencies.has(
      frequencyValue,
    )
  ) {
    redirectWithError(
      "Select a valid frequency.",
      editId,
    );
  }

  return {
    name: requireText(
      formData,
      "name",
      "Name",
      editId,
    ),
    category:
      categoryValue as FixedCostCategory,
    amount: readPositiveNumber(
      formData,
      "amount",
      "Amount",
      editId,
    ),
    frequency:
      frequencyValue as FixedCostFrequency,
    effective_date: validateDate(
      requireText(
        formData,
        "effective_date",
        "Effective date",
        editId,
      ),
      "Effective date",
      editId,
    ),
    is_active:
      formData.get("is_active") ===
      "on",
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

function revalidateFixedCostPages() {
  revalidatePath("/fixed-costs");
  revalidatePath("/settlements");
  revalidatePath("/");
}

export async function createFixedCost(
  formData: FormData,
) {
  const values =
    readFixedCostValues(formData);

  const { supabase, userId } =
    await getAuthenticatedClient();

  const { error } = await supabase
    .from("fixed_costs")
    .insert({
      user_id: userId,
      ...values,
    });

  if (error) {
    console.error(
      "Unable to create fixed cost:",
      error,
    );

    redirectWithError(
      "Axleledger could not save the fixed cost.",
    );
  }

  revalidateFixedCostPages();

  redirectWithSuccess(
    "Fixed cost added successfully.",
  );
}

export async function updateFixedCost(
  formData: FormData,
) {
  const fixedCostId = requireText(
    formData,
    "fixed_cost_id",
    "Fixed cost ID",
  );

  const values = readFixedCostValues(
    formData,
    fixedCostId,
  );

  const { supabase, userId } =
    await getAuthenticatedClient();

  const {
    data: updatedFixedCost,
    error,
  } = await supabase
    .from("fixed_costs")
    .update(values)
    .eq("id", fixedCostId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error || !updatedFixedCost) {
    console.error(
      "Unable to update fixed cost:",
      error,
    );

    redirectWithError(
      "Axleledger could not update the fixed cost.",
      fixedCostId,
    );
  }

  revalidateFixedCostPages();

  redirectWithSuccess(
    "Fixed cost updated successfully.",
  );
}

export async function deleteFixedCost(
  formData: FormData,
) {
  const fixedCostId = requireText(
    formData,
    "fixed_cost_id",
    "Fixed cost ID",
  );

  const { supabase, userId } =
    await getAuthenticatedClient();

  const {
    data: deletedFixedCost,
    error,
  } = await supabase
    .from("fixed_costs")
    .delete()
    .eq("id", fixedCostId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error || !deletedFixedCost) {
    console.error(
      "Unable to delete fixed cost:",
      error,
    );

    redirectWithError(
      error?.code === "23503"
        ? "This fixed cost is preserved in settlement history. Mark it inactive instead of deleting it."
        : "Axleledger could not delete the fixed cost.",
    );
  }

  revalidateFixedCostPages();

  redirectWithSuccess(
    "Fixed cost deleted.",
  );
}
