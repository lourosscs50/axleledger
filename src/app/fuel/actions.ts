"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

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
): never {
  const params = new URLSearchParams({
    error: message,
  });

  redirect(
    `/fuel?${params.toString()}#fuel-entry`,
  );
}

function redirectWithSuccess(
  message: string,
): never {
  const params = new URLSearchParams({
    success: message,
    saved: Date.now().toString(),
  });

  redirect(`/fuel?${params.toString()}`);
}

function requireText(
  formData: FormData,
  fieldName: string,
  displayName: string,
) {
  const value = readText(
    formData,
    fieldName,
  );

  if (!value) {
    redirectWithError(
      `${displayName} is required.`,
    );
  }

  return value;
}

function readPositiveNumber(
  formData: FormData,
  fieldName: string,
  displayName: string,
) {
  const value = Number(
    requireText(
      formData,
      fieldName,
      displayName,
    ),
  );

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    redirectWithError(
      `${displayName} must be greater than zero.`,
    );
  }

  return value;
}

function readNonnegativeNumber(
  formData: FormData,
  fieldName: string,
  displayName: string,
  defaultValue = 0,
) {
  const rawValue = readText(
    formData,
    fieldName,
  );

  const value = rawValue
    ? Number(rawValue)
    : defaultValue;

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    redirectWithError(
      `${displayName} must be zero or greater.`,
    );
  }

  return value;
}

function readOptionalInteger(
  formData: FormData,
  fieldName: string,
  displayName: string,
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
    !Number.isInteger(value) ||
    value < 0
  ) {
    redirectWithError(
      `${displayName} must be a whole number that is zero or greater.`,
    );
  }

  return value;
}

function validateDate(
  value: string,
  displayName: string,
) {
  const datePattern =
    /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(value)) {
    redirectWithError(
      `${displayName} must be a valid date.`,
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
    );
  }

  return value;
}

function validateTime(value: string) {
  if (!value) {
    return null;
  }

  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(
      value,
    )
  ) {
    redirectWithError(
      "Transaction time must be valid.",
    );
  }

  return value;
}

function readState(formData: FormData) {
  const state =
    readText(formData, "state")
      .toUpperCase();

  if (
    state &&
    !/^[A-Z]{2}$/.test(state)
  ) {
    redirectWithError(
      "State must contain a two-letter abbreviation.",
    );
  }

  return state || null;
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

function revalidateFuelPages() {
  revalidatePath("/fuel");
  revalidatePath("/expenses");
  revalidatePath("/");
}

function readSharedTransactionValues(
  formData: FormData,
) {
  return {
    p_truck_id: requireText(
      formData,
      "truck_id",
      "Truck",
    ),
    p_load_id:
      readText(formData, "load_id") ||
      null,
    p_transaction_date: validateDate(
      requireText(
        formData,
        "transaction_date",
        "Transaction date",
      ),
      "Transaction date",
    ),
    p_transaction_time: validateTime(
      readText(
        formData,
        "transaction_time",
      ),
    ),
    p_odometer: readOptionalInteger(
      formData,
      "odometer",
      "Odometer",
    ),
    p_gallons: readPositiveNumber(
      formData,
      "gallons",
      "Gallons",
    ),
    p_total_amount: readPositiveNumber(
      formData,
      "total_amount",
      "Total amount",
    ),
    p_network:
      readText(formData, "network") ||
      null,
    p_location_name:
      readText(
        formData,
        "location_name",
      ) || null,
    p_city:
      readText(formData, "city") ||
      null,
    p_state: readState(formData),
    p_notes:
      readText(formData, "notes") ||
      null,
  };
}

export async function createTruck(
  formData: FormData,
) {
  const year = readOptionalInteger(
    formData,
    "year",
    "Truck year",
  );

  if (
    year !== null &&
    (year < 1980 || year > 2100)
  ) {
    redirectWithError(
      "Truck year must be between 1980 and 2100.",
    );
  }

  const vinValue =
    readText(formData, "vin")
      .toUpperCase();

  if (
    vinValue &&
    vinValue.length !== 17
  ) {
    redirectWithError(
      "VIN must contain exactly 17 characters.",
    );
  }

  const tankCapacityValue = readText(
    formData,
    "tank_capacity_gallons",
  );

  const tankCapacity =
    tankCapacityValue
      ? readPositiveNumber(
          formData,
          "tank_capacity_gallons",
          "Tank capacity",
        )
      : null;

  const { supabase, userId } =
    await getAuthenticatedClient();

  const { error } = await supabase
    .from("trucks")
    .insert({
      user_id: userId,
      unit_number: requireText(
        formData,
        "unit_number",
        "Unit number",
      ),
      year,
      make: requireText(
        formData,
        "make",
        "Make",
      ),
      model: requireText(
        formData,
        "model",
        "Model",
      ),
      vin: vinValue || null,
      tank_capacity_gallons:
        tankCapacity,
      is_active:
        formData.get("is_active") ===
        "on",
      notes:
        readText(formData, "notes") ||
        null,
    });

  if (error) {
    console.error(
      "Unable to create truck:",
      error,
    );

    redirectWithError(
      error.code === "23505"
        ? "That unit number already exists."
        : "Axleledger could not save the truck.",
    );
  }

  revalidateFuelPages();

  redirectWithSuccess(
    "Truck added successfully.",
  );
}

export async function deleteTruck(
  formData: FormData,
) {
  const truckId = requireText(
    formData,
    "truck_id",
    "Truck ID",
  );

  const { supabase, userId } =
    await getAuthenticatedClient();

  const {
    data: deletedTruck,
    error,
  } = await supabase
    .from("trucks")
    .delete()
    .eq("id", truckId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error || !deletedTruck) {
    console.error(
      "Unable to delete truck:",
      error,
    );

    redirectWithError(
      error?.code === "23503"
        ? "This truck has fuel, DEF, or maintenance history and cannot be deleted."
        : "Axleledger could not delete the truck.",
    );
  }

  revalidateFuelPages();

  redirectWithSuccess("Truck deleted.");
}

export async function createFuelTransaction(
  formData: FormData,
) {
  const values =
    readSharedTransactionValues(
      formData,
    );

  const pumpPrice =
    readPositiveNumber(
      formData,
      "pump_price_per_gallon",
      "Pump price",
    );

  const discount =
    readNonnegativeNumber(
      formData,
      "discount_per_gallon",
      "Discount per gallon",
    );

  if (discount >= pumpPrice) {
    redirectWithError(
      "Discount per gallon must be less than the pump price.",
    );
  }

  const { supabase } =
    await getAuthenticatedClient();

  const { error } = await supabase.rpc(
    "create_fuel_transaction",
    {
      ...values,
      p_pump_price_per_gallon:
        pumpPrice,
      p_discount_per_gallon:
        discount,
    },
  );

  if (error) {
    console.error(
      "Unable to create fuel transaction:",
      error,
    );

    redirectWithError(
      "Axleledger could not save the diesel transaction.",
    );
  }

  revalidateFuelPages();

  redirectWithSuccess(
    "Diesel transaction added successfully.",
  );
}

export async function updateFuelTransaction(
  formData: FormData,
) {
  const transactionId = requireText(
    formData,
    "transaction_id",
    "Fuel transaction ID",
  );

  const values =
    readSharedTransactionValues(
      formData,
    );

  const pumpPrice =
    readPositiveNumber(
      formData,
      "pump_price_per_gallon",
      "Pump price",
    );

  const discount =
    readNonnegativeNumber(
      formData,
      "discount_per_gallon",
      "Discount per gallon",
    );

  if (discount >= pumpPrice) {
    redirectWithError(
      "Discount per gallon must be less than the pump price.",
    );
  }

  const { supabase } =
    await getAuthenticatedClient();

  const { error } = await supabase.rpc(
    "update_fuel_transaction",
    {
      p_transaction_id:
        transactionId,
      ...values,
      p_pump_price_per_gallon:
        pumpPrice,
      p_discount_per_gallon:
        discount,
    },
  );

  if (error) {
    console.error(
      "Unable to update fuel transaction:",
      error,
    );

    redirectWithError(
      error.message.includes(
        "settlement",
      ) ||
      error.message.includes(
        "Legacy",
      )
        ? error.message
        : "Axleledger could not update the diesel transaction.",
    );
  }

  revalidateFuelPages();

  redirectWithSuccess(
    "Diesel transaction updated successfully.",
  );
}

export async function deleteFuelTransaction(
  formData: FormData,
) {
  const transactionId = requireText(
    formData,
    "transaction_id",
    "Fuel transaction ID",
  );

  const { supabase } =
    await getAuthenticatedClient();

  const { error } = await supabase.rpc(
    "delete_fuel_transaction",
    {
      p_transaction_id:
        transactionId,
    },
  );

  if (error) {
    console.error(
      "Unable to delete fuel transaction:",
      error,
    );

    redirectWithError(
      "Axleledger could not delete the diesel transaction.",
    );
  }

  revalidateFuelPages();

  redirectWithSuccess(
    "Diesel transaction deleted.",
  );
}

export async function createDefTransaction(
  formData: FormData,
) {
  const values =
    readSharedTransactionValues(
      formData,
    );

  const { supabase } =
    await getAuthenticatedClient();

  const { error } = await supabase.rpc(
    "create_def_transaction",
    {
      ...values,
      p_price_per_gallon:
        readPositiveNumber(
          formData,
          "price_per_gallon",
          "DEF price",
        ),
    },
  );

  if (error) {
    console.error(
      "Unable to create DEF transaction:",
      error,
    );

    redirectWithError(
      "Axleledger could not save the DEF transaction.",
    );
  }

  revalidateFuelPages();

  redirectWithSuccess(
    "DEF transaction added successfully.",
  );
}

export async function updateDefTransaction(
  formData: FormData,
) {
  const transactionId = requireText(
    formData,
    "transaction_id",
    "DEF transaction ID",
  );

  const values =
    readSharedTransactionValues(
      formData,
    );

  const { supabase } =
    await getAuthenticatedClient();

  const { error } = await supabase.rpc(
    "update_def_transaction",
    {
      p_transaction_id:
        transactionId,
      ...values,
      p_price_per_gallon:
        readPositiveNumber(
          formData,
          "price_per_gallon",
          "DEF price",
        ),
    },
  );

  if (error) {
    console.error(
      "Unable to update DEF transaction:",
      error,
    );

    redirectWithError(
      error.message.includes(
        "settlement",
      )
        ? error.message
        : "Axleledger could not update the DEF transaction.",
    );
  }

  revalidateFuelPages();

  redirectWithSuccess(
    "DEF transaction updated successfully.",
  );
}

export async function deleteDefTransaction(
  formData: FormData,
) {
  const transactionId = requireText(
    formData,
    "transaction_id",
    "DEF transaction ID",
  );

  const { supabase } =
    await getAuthenticatedClient();

  const { error } = await supabase.rpc(
    "delete_def_transaction",
    {
      p_transaction_id:
        transactionId,
    },
  );

  if (error) {
    console.error(
      "Unable to delete DEF transaction:",
      error,
    );

    redirectWithError(
      "Axleledger could not delete the DEF transaction.",
    );
  }

  revalidateFuelPages();

  redirectWithSuccess(
    "DEF transaction deleted.",
  );
}
