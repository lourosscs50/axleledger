export type MaintenanceStatus =
  | "scheduled"
  | "completed";

export type MaintenanceCategory =
  | "preventive"
  | "repair"
  | "tires"
  | "inspection"
  | "fluids"
  | "brakes"
  | "electrical"
  | "engine"
  | "transmission"
  | "suspension"
  | "emissions"
  | "other"
  | "legacy";

export type TruckOption = {
  id: string;
  unit_number: string;
  year: number | null;
  make: string;
  model: string;
  is_active: boolean;
};

export type LoadOption = {
  id: string;
  load_number: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
};

export type MaintenanceRecord = {
  id: string;
  expense_id: string | null;
  truck_id: string | null;
  load_id: string | null;
  status: MaintenanceStatus;
  service_category: MaintenanceCategory;
  work_description: string;
  vendor: string | null;
  scheduled_date: string | null;
  scheduled_odometer: number | null;
  completed_date: string | null;
  odometer: number | null;
  parts_cost: number;
  labor_cost: number;
  tax_cost: number;
  other_cost: number;
  total_cost: number;
  next_service_date: string | null;
  next_service_odometer: number | null;
  warranty_covered: boolean;
  warranty_provider: string | null;
  warranty_claim_number: string | null;
  warranty_expiration_date: string | null;
  warranty_expiration_odometer:
    | number
    | null;
  notes: string | null;
  is_legacy: boolean;
  created_at: string;
  updated_at: string;
};
