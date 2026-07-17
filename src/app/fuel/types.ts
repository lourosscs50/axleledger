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
