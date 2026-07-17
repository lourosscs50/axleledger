"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const expenseCategories = [
  "maintenance",
  "tolls",
  "parking",
  "scales",
  "food",
  "supplies",
  "other",
] as const;

type ExpenseCategory =
  (typeof expenseCategories)[number];

type ExpenseValues = {
  load_id: string | null;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  vendor: string | null;
  notes: string | null;
};

const allowedCategories =
  new Set<string>(expenseCategories);

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
  editExpenseId?: string,
): never {
  const searchParams =
    new URLSearchParams({
      error: message,
    });

  if (editExpenseId) {
    searchParams.set(
      "edit",
      editExpenseId,
    );
  }

  redirect(
    `/expenses?${searchParams.toString()}#expense-form`,
  );
}

function redirectWithSuccess(
  message: string,
): never {
  const searchParams =
    new URLSearchParams({
      success: message,
      saved: Date.now().toString(),
    });

  redirect(
    `/expenses?${searchParams.toString()}`,
  );
}

function requireText(
  formData: FormData,
  fieldName: string,
  displayName: string,
  editExpenseId?: string,
) {
  const value = readText(
    formData,
    fieldName,
  );

  if (!value) {
    redirectWithError(
      `${displayName} is required.`,
      editExpenseId,
    );
  }

  return value;
}

function readPositiveNumber(
  formData: FormData,
  fieldName: string,
  displayName: string,
  editExpenseId?: string,
) {
  const rawValue = requireText(
    formData,
    fieldName,
    displayName,
    editExpenseId,
  );

  const value = Number(rawValue);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    redirectWithError(
      `${displayName} must be greater than zero.`,
      editExpenseId,
    );
  }

  return value;
}

function validateDate(
  value: string,
  displayName: string,
  editExpenseId?: string,
) {
  const datePattern =
    /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(value)) {
    redirectWithError(
      `${displayName} must be a valid date.`,
      editExpenseId,
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
      editExpenseId,
    );
  }

  return value;
}

function readExpenseValues(
  formData: FormData,
  editExpenseId?: string,
): ExpenseValues {
  const loadId =
    readText(formData, "load_id") ||
    null;

  const categoryValue = requireText(
    formData,
    "category",
    "Expense category",
    editExpenseId,
  );

  if (
    !allowedCategories.has(
      categoryValue,
    )
  ) {
    redirectWithError(
      "Select a valid expense category.",
      editExpenseId,
    );
  }

  const category =
    categoryValue as ExpenseCategory;

  const amount = readPositiveNumber(
    formData,
    "amount",
    "Amount",
    editExpenseId,
  );

  const expenseDate = validateDate(
    requireText(
      formData,
      "expense_date",
      "Expense date",
      editExpenseId,
    ),
    "Expense date",
    editExpenseId,
  );

  const vendor =
    readText(formData, "vendor") ||
    null;

  const notes =
    readText(formData, "notes") ||
    null;

  return {
    load_id: loadId,
    category,
    amount,
    expense_date: expenseDate,
    vendor,
    notes,
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
  editExpenseId?: string,
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
      "Select a valid load for this expense.",
      editExpenseId,
    );
  }
}

function revalidateExpensePages() {
  revalidatePath("/expenses");
  revalidatePath("/");
}

export async function createExpense(
  formData: FormData,
) {
  const expenseValues =
    readExpenseValues(formData);

  const { supabase, userId } =
    await getAuthenticatedClient();

  await validateLinkedLoad(
    supabase,
    userId,
    expenseValues.load_id,
  );

  const { error } = await supabase
    .from("expenses")
    .insert({
      user_id: userId,
      ...expenseValues,
    });

  if (error) {
    console.error(
      "Unable to create expense:",
      error,
    );

    redirectWithError(
      "Axleledger could not save the expense.",
    );
  }

  revalidateExpensePages();

  redirectWithSuccess(
    "Expense added successfully.",
  );
}

export async function updateExpense(
  formData: FormData,
) {
  const expenseId = requireText(
    formData,
    "expense_id",
    "Expense ID",
  );

  const expenseValues =
    readExpenseValues(
      formData,
      expenseId,
    );

  const { supabase, userId } =
    await getAuthenticatedClient();

  await validateLinkedLoad(
    supabase,
    userId,
    expenseValues.load_id,
    expenseId,
  );

  const {
    data: updatedExpense,
    error,
  } = await supabase
    .from("expenses")
    .update(expenseValues)
    .eq("id", expenseId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error || !updatedExpense) {
    console.error(
      "Unable to update expense:",
      error,
    );

    redirectWithError(
      "Axleledger could not update the expense.",
      expenseId,
    );
  }

  revalidateExpensePages();

  redirectWithSuccess(
    "Expense updated successfully.",
  );
}

export async function deleteExpense(
  formData: FormData,
) {
  const expenseId = requireText(
    formData,
    "expense_id",
    "Expense ID",
  );

  const { supabase, userId } =
    await getAuthenticatedClient();

  const {
    data: deletedExpense,
    error,
  } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error || !deletedExpense) {
    console.error(
      "Unable to delete expense:",
      error,
    );

    redirectWithError(
      "Axleledger could not delete the expense.",
    );
  }

  revalidateExpensePages();

  redirectWithSuccess(
    "Expense deleted.",
  );
}
