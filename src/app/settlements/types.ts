export type SettlementStatus =
  | "draft"
  | "review_needed"
  | "approved"
  | "paid"
  | "reopened";

export type SettlementLineItemKind =
  | "earning"
  | "deduction"
  | "reimbursement";

export type SettlementRecord = {
  id: string;
  statement_number: string | null;
  settlement_date: string;
  period_start_date: string | null;
  period_end_date: string | null;
  carrier_or_company: string | null;
  gross_pay: number;
  deductions: number;
  reimbursements: number;
  net_deposit: number;
  status: SettlementStatus;
  review_submitted_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  reopened_at: string | null;
  approval_version: number;
  notes: string | null;
  created_at: string;
};

export type SettlementLineItemRecord = {
  id: string;
  settlement_id: string;
  load_id: string | null;
  expense_id: string | null;
  source_type: "expense" | null;
  source_amount: number | null;
  variance_reason: string | null;
  kind: SettlementLineItemKind;
  category: string;
  description: string;
  amount: number;
  authorization_reference: string | null;
  balance_after: number | null;
  created_at: string;
};

export type SettlementAdjustmentRecord = {
  id: string;
  settlement_id: string;
  amount: number;
  reason: string;
  created_at: string;
};

export type SettlementAuditRecord = {
  id: string;
  settlement_id: string;
  event_type: string;
  from_status: SettlementStatus | null;
  to_status: SettlementStatus | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type ApprovalSnapshotRecord = {
  id: string;
  settlement_id: string;
  approval_version: number;
  created_at: string;
};

export type LoadOption = {
  id: string;
  load_number: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
};

export type ExpenseOption = {
  id: string;
  load_id: string | null;
  category: string;
  amount: number;
  expense_date: string;
  vendor: string | null;
  notes: string | null;
  load_label: string | null;
};
