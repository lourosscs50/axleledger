begin;

create table if not exists public.loads (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references auth.users(id)
    on delete cascade,

  load_number text not null
    check (length(trim(load_number)) > 0),

  carrier_or_broker text,

  origin_city text not null
    check (length(trim(origin_city)) > 0),

  origin_state text not null
    check (length(trim(origin_state)) > 0),

  destination_city text not null
    check (length(trim(destination_city)) > 0),

  destination_state text not null
    check (length(trim(destination_state)) > 0),

  pickup_date date not null,

  delivery_date date,

  gross_revenue numeric(12, 2) not null default 0
    check (gross_revenue >= 0),

  loaded_miles integer not null default 0
    check (loaded_miles >= 0),

  deadhead_miles integer not null default 0
    check (deadhead_miles >= 0),

  status text not null default 'planned'
    check (
      status in (
        'planned',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),

  notes text,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint loads_delivery_after_pickup
    check (
      delivery_date is null
      or delivery_date >= pickup_date
    )
);

create index if not exists loads_user_id_idx
  on public.loads (user_id);

create index if not exists loads_user_pickup_date_idx
  on public.loads (user_id, pickup_date desc);

create index if not exists loads_user_delivery_date_idx
  on public.loads (user_id, delivery_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists loads_set_updated_at
on public.loads;

create trigger loads_set_updated_at
before update on public.loads
for each row
execute function public.set_updated_at();

alter table public.loads enable row level security;

revoke all on table public.loads from anon;

grant select, insert, update, delete
on table public.loads
to authenticated;

drop policy if exists "loads_select_own"
on public.loads;

create policy "loads_select_own"
on public.loads
for select
to authenticated
using (
  (select auth.uid()) = user_id
);

drop policy if exists "loads_insert_own"
on public.loads;

create policy "loads_insert_own"
on public.loads
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
);

drop policy if exists "loads_update_own"
on public.loads;

create policy "loads_update_own"
on public.loads
for update
to authenticated
using (
  (select auth.uid()) = user_id
)
with check (
  (select auth.uid()) = user_id
);

drop policy if exists "loads_delete_own"
on public.loads;

create policy "loads_delete_own"
on public.loads
for delete
to authenticated
using (
  (select auth.uid()) = user_id
);

commit;
