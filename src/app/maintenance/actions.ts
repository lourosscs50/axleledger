"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import type {
  MaintenanceCategory,
  MaintenanceStatus,
} from "./types";

const maintenanceStatuses = [
  "scheduled",
  "completed",
] as const;

const maintenanceCategories = [
  "preventive",
  "repair",
  "tires",
  "inspection",
  "fluids",
  "brakes",
  "electrical",
  "engine",
  "transmission",
  "suspension",
  "emissions",
  "other",
  "legacy",
] as const;

const allowedStatuses =
  new Set<string>(maintenanceStatuses);

const allowedCategories =
  new Set<string>(maintenanceCategories);

type MaintenanceRpcValues = {
  p_truck_id: string | null;
  p_load_id: string | null;
  p_status: MaintenanceStatus;
  p_service_category:
    MaintenanceCategory;
  p_work_description: string;
  p_vendor: string | null;
  p_scheduled_date: string | null;
  p_scheduled_odometer:
    | number
    | null;
  p_completed_date: string | null;
  p_odometer: number | null;
  p_parts_cost: number;
  p_labor_cost: number;
  p_tax_cost: number;
  p_other_cost: number;
  p_next_service_date: string | null;
  p_next_service_odometer:
    | number
    | null;
  p_warranty_covered: boolean;
  p_warranty_provider: string | null;
  p_warranty_claim_number:
    | string
    | null;
  p_warranty_expiration_date:
    | string
    | null;
  p_warranty_expiration_odometer:
    | number
    | null;
  p_notes: string | null;
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
  editRecordId?: string,
): never {
  const params = new URLSearchParams({
    error: message,
  });

  if (editRecordId) {
    params.set("edit", editRecordId);
  }

  redirect(
    `/maintenance?${params.toString()}#maintenance-form`,
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
    `/maintenance?${params.toString()}`,
  );
}

function requireText(
  formData: FormData,
  fieldName: string,
  displayName: string,
  editRecordId?: string,
) {
  const value = readText(
    formData,
    fieldName,
  );

  if (!value) {
    redirectWithError(
      `${displayName} is required.`,
      editRecordId,
    );
  }

  return value;
}

function validateDate(
  value: string,
  displayName: string,
  editRecordId?: string,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    redirectWithError(
      `${displayName} must be a valid date.`,
      editRecordId,
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
      editRecordId,
    );
  }

  return value;
}

function readOptionalDate(
  formData: FormData,
  fieldName: string,
  displayName: string,
  editRecordId?: string,
) {
  const value = readText(
    formData,
    fieldName,
  );

  return value
    ? validateDate(
        value,
        displayName,
        editRecordId,
      )
    : null;
}

function readOptionalNonnegativeInteger(
  formData: FormData,
  fieldName: string,
  displayName: string,
  editRecordId?: string,
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
      editRecordId,
    );
  }

  return value;
}

function readNonnegativeNumber(
  formData: FormData,
  fieldName: string,
  displayName: string,
  editRecordId?: string,
) {
  const rawValue = readText(
    formData,
    fieldName,
  );

  const value = rawValue
    ? Number(rawValue)
    : 0;

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    redirectWithError(
      `${displayName} must be zero or greater.`,
      editRecordId,
    );
  }

  return value;
}

function readMaintenanceValues(
  formData: FormData,
  editRecordId?: string,
): MaintenanceRpcValues {
  const statusValue = requireText(
    formData,
    "status",
    "Maintenance status",
    editRecordId,
  );

  if (!allowedStatuses.has(statusValue)) {
    redirectWithError(
      "Select a valid maintenance status.",
      editRecordId,
    );
  }

  const status =
    statusValue as MaintenanceStatus;

  const categoryValue = requireText(
    formData,
    "service_category",
    "Service category",
    editRecordId,
  );

  if (
    !allowedCategories.has(
      categoryValue,
    ) ||
    (!editRecordId &&
      categoryValue === "legacy")
  ) {
    redirectWithError(
      "Select a valid service category.",
      editRecordId,
    );
  }

  const serviceCategory =
    categoryValue as MaintenanceCategory;

  const truckId =
    readText(formData, "truck_id") ||
    null;

  if (!truckId && !editRecordId) {
    redirectWithError(
      "Truck is required.",
      editRecordId,
    );
  }

  const scheduledDate =
    readOptionalDate(
      formData,
      "scheduled_date",
      "Scheduled date",
      editRecordId,
    );

  const scheduledOdometer =
    readOptionalNonnegativeInteger(
      formData,
      "scheduled_odometer",
      "Scheduled odometer",
      editRecordId,
    );

  const completedDate =
    readOptionalDate(
      formData,
      "completed_date",
      "Completion date",
      editRecordId,
    );

  const odometer =
    readOptionalNonnegativeInteger(
      formData,
      "odometer",
      "Service odometer",
      editRecordId,
    );

  const nextServiceDate =
    readOptionalDate(
      formData,
      "next_service_date",
      "Next-service date",
      editRecordId,
    );

  const nextServiceOdometer =
    readOptionalNonnegativeInteger(
      formData,
      "next_service_odometer",
      "Next-service odometer",
      editRecordId,
    );

  const warrantyExpirationDate =
    readOptionalDate(
      formData,
      "warranty_expiration_date",
      "Warranty expiration date",
      editRecordId,
    );

  const warrantyExpirationOdometer =
    readOptionalNonnegativeInteger(
      formData,
      "warranty_expiration_odometer",
      "Warranty expiration odometer",
      editRecordId,
    );

  const partsCost =
    readNonnegativeNumber(
      formData,
      "parts_cost",
      "Parts cost",
      editRecordId,
    );

  const laborCost =
    readNonnegativeNumber(
      formData,
      "labor_cost",
      "Labor cost",
      editRecordId,
    );

  const taxCost =
    readNonnegativeNumber(
      formData,
      "tax_cost",
      "Tax cost",
      editRecordId,
    );

  const otherCost =
    readNonnegativeNumber(
      formData,
      "other_cost",
      "Other cost",
      editRecordId,
    );

  const warrantyCovered =
    status === "completed" &&
    formData.get("warranty_covered") ===
      "on";

  if (
    status === "scheduled" &&
    !scheduledDate &&
    scheduledOdometer === null
  ) {
    redirectWithError(
      "Scheduled maintenance requires a due date or odometer target.",
      editRecordId,
    );
  }

  if (
    status === "scheduled" &&
    (completedDate ||
      partsCost > 0 ||
      laborCost > 0 ||
      taxCost > 0 ||
      otherCost > 0 ||
      nextServiceDate ||
      nextServiceOdometer !== null ||
      warrantyCovered)
  ) {
    redirectWithError(
      "Completion costs, next-service targets, and warranty details belong on completed maintenance.",
      editRecordId,
    );
  }

  if (
    status === "completed" &&
    !completedDate
  ) {
    redirectWithError(
      "Completed maintenance requires a completion date.",
      editRecordId,
    );
  }

  if (
    completedDate &&
    nextServiceDate &&
    nextServiceDate < completedDate
  ) {
    redirectWithError(
      "Next-service date cannot be before the completion date.",
      editRecordId,
    );
  }

  if (
    odometer !== null &&
    nextServiceOdometer !== null &&
    nextServiceOdometer <= odometer
  ) {
    redirectWithError(
      "Next-service odometer must be greater than the service odometer.",
      editRecordId,
    );
  }

  if (
    warrantyCovered &&
    completedDate &&
    warrantyExpirationDate &&
    warrantyExpirationDate <
      completedDate
  ) {
    redirectWithError(
      "Warranty expiration date cannot be before the completion date.",
      editRecordId,
    );
  }

  if (
    warrantyCovered &&
    odometer !== null &&
    warrantyExpirationOdometer !==
      null &&
    warrantyExpirationOdometer <
      odometer
  ) {
    redirectWithError(
      "Warranty expiration odometer cannot be below the service odometer.",
      editRecordId,
    );
  }

  return {
    p_truck_id: truckId,
    p_load_id:
      readText(formData, "load_id") ||
      null,
    p_status: status,
    p_service_category:
      serviceCategory,
    p_work_description: requireText(
      formData,
      "work_description",
      "Work description",
      editRecordId,
    ),
    p_vendor:
      readText(formData, "vendor") ||
      null,
    p_scheduled_date:
      scheduledDate,
    p_scheduled_odometer:
      scheduledOdometer,
    p_completed_date:
      status === "completed"
        ? completedDate
        : null,
    p_odometer:
      status === "completed"
        ? odometer
        : null,
    p_parts_cost:
      status === "completed"
        ? partsCost
        : 0,
    p_labor_cost:
      status === "completed"
        ? laborCost
        : 0,
    p_tax_cost:
      status === "completed"
        ? taxCost
        : 0,
    p_other_cost:
      status === "completed"
        ? otherCost
        : 0,
    p_next_service_date:
      status === "completed"
        ? nextServiceDate
        : null,
    p_next_service_odometer:
      status === "completed"
        ? nextServiceOdometer
        : null,
    p_warranty_covered:
      warrantyCovered,
    p_warranty_provider:
      warrantyCovered
        ? readText(
            formData,
            "warranty_provider",
          ) || null
        : null,
    p_warranty_claim_number:
      warrantyCovered
        ? readText(
            formData,
            "warranty_claim_number",
          ) || null
        : null,
    p_warranty_expiration_date:
      warrantyCovered
        ? warrantyExpirationDate
        : null,
    p_warranty_expiration_odometer:
      warrantyCovered
        ? warrantyExpirationOdometer
        : null,
    p_notes:
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

function revalidateMaintenancePages() {
  revalidatePath("/maintenance");
  revalidatePath("/expenses");
  revalidatePath("/fuel");
  revalidatePath("/");
}

function getDatabaseErrorMessage(
  error: {
    code?: string;
    message?: string;
  },
) {
  const message =
    error.message ?? "";

  if (
    message.includes(
      "Scheduled maintenance requires",
    ) ||
    message.includes(
      "Completed maintenance requires",
    ) ||
    message.includes(
      "Next-service",
    ) ||
    message.includes("Warranty")
  ) {
    return message;
  }

  if (error.code === "P0002") {
    return "That maintenance record could not be found.";
  }

  return "Axleledger could not save the maintenance record.";
}

export async function createMaintenanceRecord(
  formData: FormData,
) {
  const values =
    readMaintenanceValues(formData);

  const { supabase } =
    await getAuthenticatedClient();

  const { error } = await supabase.rpc(
    "create_maintenance_record",
    values,
  );

  if (error) {
    console.error(
      "Unable to create maintenance record:",
      error,
    );

    redirectWithError(
      getDatabaseErrorMessage(error),
    );
  }

  revalidateMaintenancePages();

  redirectWithSuccess(
    values.p_status === "completed"
      ? "Completed maintenance added successfully."
      : "Maintenance scheduled successfully.",
  );
}

export async function updateMaintenanceRecord(
  formData: FormData,
) {
  const recordId = requireText(
    formData,
    "maintenance_record_id",
    "Maintenance record ID",
  );

  const values =
    readMaintenanceValues(
      formData,
      recordId,
    );

  const { supabase } =
    await getAuthenticatedClient();

  const { error } = await supabase.rpc(
    "update_maintenance_record",
    {
      p_record_id: recordId,
      ...values,
    },
  );

  if (error) {
    console.error(
      "Unable to update maintenance record:",
      error,
    );

    redirectWithError(
      getDatabaseErrorMessage(error),
      recordId,
    );
  }

  revalidateMaintenancePages();

  redirectWithSuccess(
    "Maintenance record updated successfully.",
  );
}

export async function deleteMaintenanceRecord(
  formData: FormData,
) {
  const recordId = requireText(
    formData,
    "maintenance_record_id",
    "Maintenance record ID",
  );

  const { supabase } =
    await getAuthenticatedClient();

  const { error } = await supabase.rpc(
    "delete_maintenance_record",
    {
      p_record_id: recordId,
    },
  );

  if (error) {
    console.error(
      "Unable to delete maintenance record:",
      error,
    );

    redirectWithError(
      error.code === "P0002"
        ? "That maintenance record could not be found."
        : "Axleledger could not delete the maintenance record.",
    );
  }

  revalidateMaintenancePages();

  redirectWithSuccess(
    "Maintenance record deleted.",
  );
}
