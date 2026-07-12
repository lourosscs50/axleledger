"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const loadStatuses = [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
] as const;

type LoadStatus =
  (typeof loadStatuses)[number];

type LoadValues = {
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
};

const allowedStatuses =
  new Set<string>(loadStatuses);

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
  editLoadId?: string,
): never {
  const searchParams =
    new URLSearchParams({
      error: message,
    });

  if (editLoadId) {
    searchParams.set("edit", editLoadId);
  }

  redirect(
    `/loads?${searchParams.toString()}#load-form`,
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
    `/loads?${searchParams.toString()}`,
  );
}

function requireText(
  formData: FormData,
  fieldName: string,
  displayName: string,
  editLoadId?: string,
) {
  const value = readText(
    formData,
    fieldName,
  );

  if (!value) {
    redirectWithError(
      `${displayName} is required.`,
      editLoadId,
    );
  }

  return value;
}

function readNonNegativeNumber(
  formData: FormData,
  fieldName: string,
  displayName: string,
  editLoadId?: string,
) {
  const rawValue = readText(
    formData,
    fieldName,
  );

  const value = Number(rawValue || "0");

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    redirectWithError(
      `${displayName} must be zero or greater.`,
      editLoadId,
    );
  }

  return value;
}

function readNonNegativeInteger(
  formData: FormData,
  fieldName: string,
  displayName: string,
  editLoadId?: string,
) {
  const value = readNonNegativeNumber(
    formData,
    fieldName,
    displayName,
    editLoadId,
  );

  if (!Number.isInteger(value)) {
    redirectWithError(
      `${displayName} must be a whole number.`,
      editLoadId,
    );
  }

  return value;
}

function validateDate(
  value: string,
  displayName: string,
  editLoadId?: string,
) {
  const datePattern =
    /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(value)) {
    redirectWithError(
      `${displayName} must be a valid date.`,
      editLoadId,
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
      editLoadId,
    );
  }

  return value;
}

function readLoadValues(
  formData: FormData,
  editLoadId?: string,
): LoadValues {
  const loadNumber = requireText(
    formData,
    "load_number",
    "Load number",
    editLoadId,
  );

  const carrierOrBroker =
    readText(
      formData,
      "carrier_or_broker",
    ) || null;

  const originCity = requireText(
    formData,
    "origin_city",
    "Origin city",
    editLoadId,
  );

  const originState = requireText(
    formData,
    "origin_state",
    "Origin state",
    editLoadId,
  ).toUpperCase();

  const destinationCity = requireText(
    formData,
    "destination_city",
    "Destination city",
    editLoadId,
  );

  const destinationState = requireText(
    formData,
    "destination_state",
    "Destination state",
    editLoadId,
  ).toUpperCase();

  const statePattern = /^[A-Z]{2}$/;

  if (
    !statePattern.test(originState) ||
    !statePattern.test(destinationState)
  ) {
    redirectWithError(
      "State abbreviations must contain two letters.",
      editLoadId,
    );
  }

  const pickupDate = validateDate(
    requireText(
      formData,
      "pickup_date",
      "Pickup date",
      editLoadId,
    ),
    "Pickup date",
    editLoadId,
  );

  const deliveryDateValue = readText(
    formData,
    "delivery_date",
  );

  const deliveryDate = deliveryDateValue
    ? validateDate(
        deliveryDateValue,
        "Delivery date",
        editLoadId,
      )
    : null;

  if (
    deliveryDate &&
    deliveryDate < pickupDate
  ) {
    redirectWithError(
      "Delivery date cannot be before pickup date.",
      editLoadId,
    );
  }

  const grossRevenue =
    readNonNegativeNumber(
      formData,
      "gross_revenue",
      "Gross revenue",
      editLoadId,
    );

  const loadedMiles =
    readNonNegativeInteger(
      formData,
      "loaded_miles",
      "Loaded miles",
      editLoadId,
    );

  const deadheadMiles =
    readNonNegativeInteger(
      formData,
      "deadhead_miles",
      "Deadhead miles",
      editLoadId,
    );

  const statusValue = requireText(
    formData,
    "status",
    "Load status",
    editLoadId,
  );

  if (!allowedStatuses.has(statusValue)) {
    redirectWithError(
      "Select a valid load status.",
      editLoadId,
    );
  }

  const status =
    statusValue as LoadStatus;

  if (
    status === "completed" &&
    !deliveryDate
  ) {
    redirectWithError(
      "Completed loads require a delivery date.",
      editLoadId,
    );
  }

  const notes =
    readText(formData, "notes") || null;

  return {
    load_number: loadNumber,
    carrier_or_broker: carrierOrBroker,
    origin_city: originCity,
    origin_state: originState,
    destination_city: destinationCity,
    destination_state: destinationState,
    pickup_date: pickupDate,
    delivery_date: deliveryDate,
    gross_revenue: grossRevenue,
    loaded_miles: loadedMiles,
    deadhead_miles: deadheadMiles,
    status,
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

function revalidateLoadPages() {
  revalidatePath("/loads");
  revalidatePath("/");
}

export async function createLoad(
  formData: FormData,
) {
  const loadValues =
    readLoadValues(formData);

  const { supabase, userId } =
    await getAuthenticatedClient();

  const { error } = await supabase
    .from("loads")
    .insert({
      user_id: userId,
      ...loadValues,
    });

  if (error) {
    console.error(
      "Unable to create load:",
      error,
    );

    redirectWithError(
      "Axleledger could not save the load.",
    );
  }

  revalidateLoadPages();

  redirectWithSuccess(
    "Load added successfully.",
  );
}

export async function updateLoad(
  formData: FormData,
) {
  const loadId = requireText(
    formData,
    "load_id",
    "Load ID",
  );

  const loadValues = readLoadValues(
    formData,
    loadId,
  );

  const { supabase, userId } =
    await getAuthenticatedClient();

  const {
    data: updatedLoad,
    error,
  } = await supabase
    .from("loads")
    .update(loadValues)
    .eq("id", loadId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error || !updatedLoad) {
    console.error(
      "Unable to update load:",
      error,
    );

    redirectWithError(
      "Axleledger could not update the load.",
      loadId,
    );
  }

  revalidateLoadPages();

  redirectWithSuccess(
    "Load updated successfully.",
  );
}

export async function deleteLoad(
  formData: FormData,
) {
  const loadId = requireText(
    formData,
    "load_id",
    "Load ID",
  );

  const { supabase, userId } =
    await getAuthenticatedClient();

  const {
    data: deletedLoad,
    error,
  } = await supabase
    .from("loads")
    .delete()
    .eq("id", loadId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error || !deletedLoad) {
    console.error(
      "Unable to delete load:",
      error,
    );

    redirectWithError(
      "Axleledger could not delete the load.",
    );
  }

  revalidateLoadPages();

  redirectWithSuccess("Load deleted.");
}
