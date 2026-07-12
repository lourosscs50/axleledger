create table if not exists public.fixed_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  name text not null,

  category text not null
    check (
      category in (
        'truck_payment',
        'insurance',
        'permits',
        'communications',
        'subscriptions',
        'other'
      )
    ),

  amount numeric(12, 2) not null
    check (amount > 0),

  frequency text not null
    check (
      frequency in (
        'weekly',
        'monthly'
      )
    ),

  effective_date date not null,
  is_active boolean not null default true,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists
  fixed_costs_user_active_idx
on public.fixed_costs (
  user_id,
  is_active,
  effective_date
);

alter table public.fixed_costs
  enable row level security;

drop policy if exists
  "Users can view their fixed costs"
on public.fixed_costs;

create policy
  "Users can view their fixed costs"
on public.fixed_costs
for select
using (auth.uid() = user_id);

drop policy if exists
  "Users can create their fixed costs"
on public.fixed_costs;

create policy
  "Users can create their fixed costs"
on public.fixed_costs
for insert
with check (auth.uid() = user_id);

drop policy if exists
  "Users can update their fixed costs"
on public.fixed_costs;

create policy
  "Users can update their fixed costs"
on public.fixed_costs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists
  "Users can delete their fixed costs"
on public.fixed_costs;

create policy
  "Users can delete their fixed costs"
on public.fixed_costs
for delete
using (auth.uid() = user_id);
