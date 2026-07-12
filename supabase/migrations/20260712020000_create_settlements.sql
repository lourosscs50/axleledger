create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  settlement_date date not null,
  carrier_or_company text,

  gross_pay numeric(12, 2) not null
    check (gross_pay >= 0),

  deductions numeric(12, 2) not null default 0
    check (deductions >= 0),

  reimbursements numeric(12, 2) not null default 0
    check (reimbursements >= 0),

  net_deposit numeric(12, 2) not null
    check (net_deposit >= 0),

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists
  settlements_user_settlement_date_idx
on public.settlements (
  user_id,
  settlement_date desc
);

alter table public.settlements
  enable row level security;

drop policy if exists
  "Users can view their settlements"
on public.settlements;

create policy
  "Users can view their settlements"
on public.settlements
for select
using (auth.uid() = user_id);

drop policy if exists
  "Users can create their settlements"
on public.settlements;

create policy
  "Users can create their settlements"
on public.settlements
for insert
with check (auth.uid() = user_id);

drop policy if exists
  "Users can update their settlements"
on public.settlements;

create policy
  "Users can update their settlements"
on public.settlements
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists
  "Users can delete their settlements"
on public.settlements;

create policy
  "Users can delete their settlements"
on public.settlements
for delete
using (auth.uid() = user_id);
