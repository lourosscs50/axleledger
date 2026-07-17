begin;

alter table public.expenses
  drop constraint if exists expenses_category_check;

alter table public.expenses
  add constraint expenses_category_check
  check (
    category in (
      'fuel',
      'def',
      'maintenance',
      'tolls',
      'parking',
      'scales',
      'food',
      'supplies',
      'other'
    )
  );

create table if not exists public.trucks (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references auth.users(id)
    on delete cascade,

  unit_number text not null,
  year integer,
  make text not null,
  model text not null,
  vin text,
  tank_capacity_gallons numeric(8, 2),
  is_active boolean not null default true,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trucks_unit_number_not_blank
    check (length(trim(unit_number)) > 0),

  constraint trucks_make_not_blank
    check (length(trim(make)) > 0),

  constraint trucks_model_not_blank
    check (length(trim(model)) > 0),

  constraint trucks_year_valid
    check (
      year is null
      or year between 1980 and 2100
    ),

  constraint trucks_vin_valid
    check (
      vin is null
      or length(trim(vin)) = 17
    ),

  constraint trucks_tank_capacity_positive
    check (
      tank_capacity_gallons is null
      or tank_capacity_gallons > 0
    ),

  constraint trucks_notes_not_blank
    check (
      notes is null
      or length(trim(notes)) > 0
    ),

  constraint trucks_user_unit_number_unique
    unique (user_id, unit_number)
);

create index if not exists
  trucks_user_active_idx
on public.trucks (
  user_id,
  is_active,
  unit_number
);

create table if not exists public.fuel_transactions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references auth.users(id)
    on delete cascade,

  expense_id uuid not null unique
    references public.expenses(id)
    on delete cascade,

  truck_id uuid
    references public.trucks(id)
    on delete restrict,

  load_id uuid
    references public.loads(id)
    on delete set null,

  transaction_date date not null,
  transaction_time time,
  odometer integer,
  gallons numeric(10, 3),
  pump_price_per_gallon numeric(8, 4),
  discount_per_gallon numeric(8, 4),
  net_price_per_gallon numeric(8, 4),
  total_amount numeric(12, 2) not null,

  network text,
  location_name text,
  city text,
  state text,
  notes text,

  is_legacy boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fuel_transactions_total_positive
    check (total_amount > 0),

  constraint fuel_transactions_odometer_valid
    check (
      odometer is null
      or odometer >= 0
    ),

  constraint fuel_transactions_gallons_valid
    check (
      gallons is null
      or gallons > 0
    ),

  constraint fuel_transactions_pump_price_valid
    check (
      pump_price_per_gallon is null
      or pump_price_per_gallon > 0
    ),

  constraint fuel_transactions_discount_valid
    check (
      discount_per_gallon is null
      or discount_per_gallon >= 0
    ),

  constraint fuel_transactions_net_price_valid
    check (
      net_price_per_gallon is null
      or net_price_per_gallon > 0
    ),

  constraint fuel_transactions_state_valid
    check (
      state is null
      or state ~ '^[A-Z]{2}$'
    ),

  constraint fuel_transactions_structured_fields
    check (
      is_legacy
      or (
        truck_id is not null
        and gallons is not null
        and pump_price_per_gallon is not null
        and discount_per_gallon is not null
        and net_price_per_gallon is not null
        and discount_per_gallon <= pump_price_per_gallon
        and abs(
          net_price_per_gallon
          - (
            pump_price_per_gallon
            - discount_per_gallon
          )
        ) <= 0.0001
      )
    )
);

create index if not exists
  fuel_transactions_user_date_idx
on public.fuel_transactions (
  user_id,
  transaction_date desc,
  created_at desc
);

create index if not exists
  fuel_transactions_user_truck_idx
on public.fuel_transactions (
  user_id,
  truck_id,
  transaction_date desc
)
where truck_id is not null;

create index if not exists
  fuel_transactions_user_load_idx
on public.fuel_transactions (
  user_id,
  load_id
)
where load_id is not null;

create table if not exists public.def_transactions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references auth.users(id)
    on delete cascade,

  expense_id uuid not null unique
    references public.expenses(id)
    on delete cascade,

  truck_id uuid not null
    references public.trucks(id)
    on delete restrict,

  load_id uuid
    references public.loads(id)
    on delete set null,

  transaction_date date not null,
  transaction_time time,
  odometer integer,
  gallons numeric(10, 3) not null,
  price_per_gallon numeric(8, 4) not null,
  total_amount numeric(12, 2) not null,

  network text,
  location_name text,
  city text,
  state text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint def_transactions_odometer_valid
    check (
      odometer is null
      or odometer >= 0
    ),

  constraint def_transactions_gallons_positive
    check (gallons > 0),

  constraint def_transactions_price_positive
    check (price_per_gallon > 0),

  constraint def_transactions_total_positive
    check (total_amount > 0),

  constraint def_transactions_state_valid
    check (
      state is null
      or state ~ '^[A-Z]{2}$'
    )
);

create index if not exists
  def_transactions_user_date_idx
on public.def_transactions (
  user_id,
  transaction_date desc,
  created_at desc
);

create index if not exists
  def_transactions_user_truck_idx
on public.def_transactions (
  user_id,
  truck_id,
  transaction_date desc
);

create index if not exists
  def_transactions_user_load_idx
on public.def_transactions (
  user_id,
  load_id
)
where load_id is not null;

drop trigger if exists
  trucks_set_updated_at
on public.trucks;

create trigger
  trucks_set_updated_at
before update
on public.trucks
for each row
execute function public.set_updated_at();

drop trigger if exists
  fuel_transactions_set_updated_at
on public.fuel_transactions;

create trigger
  fuel_transactions_set_updated_at
before update
on public.fuel_transactions
for each row
execute function public.set_updated_at();

drop trigger if exists
  def_transactions_set_updated_at
on public.def_transactions;

create trigger
  def_transactions_set_updated_at
before update
on public.def_transactions
for each row
execute function public.set_updated_at();

create or replace function
  public.protect_structured_expense_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
    and coalesce(
      current_setting(
        'axleledger.structured_expense_write',
        true
      ),
      'off'
    ) <> 'on'
    and (
      exists (
        select 1
        from public.fuel_transactions
        where expense_id = old.id
      )
      or exists (
        select 1
        from public.def_transactions
        where expense_id = old.id
      )
    )
  then
    raise exception using
      errcode = '23514',
      message =
        'Structured fuel and DEF expenses must be managed from Fuel Operations.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke execute on function
  public.protect_structured_expense_mutation()
from public, anon, authenticated;

drop trigger if exists
  expenses_protect_structured_mutation
on public.expenses;

create trigger
  expenses_protect_structured_mutation
before update or delete
on public.expenses
for each row
execute function
  public.protect_structured_expense_mutation();

create or replace function
  public.create_fuel_transaction(
    p_truck_id uuid,
    p_load_id uuid,
    p_transaction_date date,
    p_transaction_time time,
    p_odometer integer,
    p_gallons numeric,
    p_pump_price_per_gallon numeric,
    p_discount_per_gallon numeric,
    p_total_amount numeric,
    p_network text,
    p_location_name text,
    p_city text,
    p_state text,
    p_notes text
  )
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense_id uuid;
  v_transaction_id uuid;
  v_net_price numeric(8, 4);
  v_vendor text;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.trucks
    where id = p_truck_id
      and user_id = v_user_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'Select a valid truck.';
  end if;

  if p_load_id is not null
    and not exists (
      select 1
      from public.loads
      where id = p_load_id
        and user_id = v_user_id
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Select a valid load.';
  end if;

  if p_gallons <= 0
    or p_pump_price_per_gallon <= 0
    or p_discount_per_gallon < 0
    or p_discount_per_gallon >= p_pump_price_per_gallon
    or p_total_amount <= 0
  then
    raise exception using
      errcode = '23514',
      message = 'Fuel quantities and prices are invalid.';
  end if;

  if p_odometer is not null
    and p_odometer < 0
  then
    raise exception using
      errcode = '23514',
      message = 'Odometer must be zero or greater.';
  end if;

  v_net_price :=
    round(
      p_pump_price_per_gallon
      - p_discount_per_gallon,
      4
    );

  v_vendor :=
    nullif(
      trim(
        coalesce(
          p_location_name,
          p_network,
          ''
        )
      ),
      ''
    );

  insert into public.expenses (
    user_id,
    load_id,
    category,
    amount,
    expense_date,
    vendor,
    notes
  )
  values (
    v_user_id,
    p_load_id,
    'fuel',
    round(p_total_amount, 2),
    p_transaction_date,
    v_vendor,
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_expense_id;

  insert into public.fuel_transactions (
    user_id,
    expense_id,
    truck_id,
    load_id,
    transaction_date,
    transaction_time,
    odometer,
    gallons,
    pump_price_per_gallon,
    discount_per_gallon,
    net_price_per_gallon,
    total_amount,
    network,
    location_name,
    city,
    state,
    notes
  )
  values (
    v_user_id,
    v_expense_id,
    p_truck_id,
    p_load_id,
    p_transaction_date,
    p_transaction_time,
    p_odometer,
    round(p_gallons, 3),
    round(p_pump_price_per_gallon, 4),
    round(p_discount_per_gallon, 4),
    v_net_price,
    round(p_total_amount, 2),
    nullif(trim(coalesce(p_network, '')), ''),
    nullif(trim(coalesce(p_location_name, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(upper(trim(coalesce(p_state, ''))), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

create or replace function
  public.delete_fuel_transaction(
    p_transaction_id uuid
  )
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense_id uuid;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  select expense_id
  into v_expense_id
  from public.fuel_transactions
  where id = p_transaction_id
    and user_id = v_user_id;

  if v_expense_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Fuel transaction was not found.';
  end if;

  perform set_config(
    'axleledger.structured_expense_write',
    'on',
    true
  );

  delete from public.expenses
  where id = v_expense_id
    and user_id = v_user_id;
end;
$$;

create or replace function
  public.create_def_transaction(
    p_truck_id uuid,
    p_load_id uuid,
    p_transaction_date date,
    p_transaction_time time,
    p_odometer integer,
    p_gallons numeric,
    p_price_per_gallon numeric,
    p_total_amount numeric,
    p_network text,
    p_location_name text,
    p_city text,
    p_state text,
    p_notes text
  )
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense_id uuid;
  v_transaction_id uuid;
  v_vendor text;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.trucks
    where id = p_truck_id
      and user_id = v_user_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'Select a valid truck.';
  end if;

  if p_load_id is not null
    and not exists (
      select 1
      from public.loads
      where id = p_load_id
        and user_id = v_user_id
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Select a valid load.';
  end if;

  if p_gallons <= 0
    or p_price_per_gallon <= 0
    or p_total_amount <= 0
  then
    raise exception using
      errcode = '23514',
      message = 'DEF quantities and prices are invalid.';
  end if;

  if p_odometer is not null
    and p_odometer < 0
  then
    raise exception using
      errcode = '23514',
      message = 'Odometer must be zero or greater.';
  end if;

  v_vendor :=
    nullif(
      trim(
        coalesce(
          p_location_name,
          p_network,
          ''
        )
      ),
      ''
    );

  insert into public.expenses (
    user_id,
    load_id,
    category,
    amount,
    expense_date,
    vendor,
    notes
  )
  values (
    v_user_id,
    p_load_id,
    'def',
    round(p_total_amount, 2),
    p_transaction_date,
    v_vendor,
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_expense_id;

  insert into public.def_transactions (
    user_id,
    expense_id,
    truck_id,
    load_id,
    transaction_date,
    transaction_time,
    odometer,
    gallons,
    price_per_gallon,
    total_amount,
    network,
    location_name,
    city,
    state,
    notes
  )
  values (
    v_user_id,
    v_expense_id,
    p_truck_id,
    p_load_id,
    p_transaction_date,
    p_transaction_time,
    p_odometer,
    round(p_gallons, 3),
    round(p_price_per_gallon, 4),
    round(p_total_amount, 2),
    nullif(trim(coalesce(p_network, '')), ''),
    nullif(trim(coalesce(p_location_name, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(upper(trim(coalesce(p_state, ''))), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

create or replace function
  public.delete_def_transaction(
    p_transaction_id uuid
  )
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense_id uuid;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  select expense_id
  into v_expense_id
  from public.def_transactions
  where id = p_transaction_id
    and user_id = v_user_id;

  if v_expense_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'DEF transaction was not found.';
  end if;

  perform set_config(
    'axleledger.structured_expense_write',
    'on',
    true
  );

  delete from public.expenses
  where id = v_expense_id
    and user_id = v_user_id;
end;
$$;

revoke all on function
  public.create_fuel_transaction(
    uuid,
    uuid,
    date,
    time,
    integer,
    numeric,
    numeric,
    numeric,
    numeric,
    text,
    text,
    text,
    text,
    text
  )
from public, anon;

grant execute on function
  public.create_fuel_transaction(
    uuid,
    uuid,
    date,
    time,
    integer,
    numeric,
    numeric,
    numeric,
    numeric,
    text,
    text,
    text,
    text,
    text
  )
to authenticated;

revoke all on function
  public.delete_fuel_transaction(uuid)
from public, anon;

grant execute on function
  public.delete_fuel_transaction(uuid)
to authenticated;

revoke all on function
  public.create_def_transaction(
    uuid,
    uuid,
    date,
    time,
    integer,
    numeric,
    numeric,
    numeric,
    text,
    text,
    text,
    text,
    text
  )
from public, anon;

grant execute on function
  public.create_def_transaction(
    uuid,
    uuid,
    date,
    time,
    integer,
    numeric,
    numeric,
    numeric,
    text,
    text,
    text,
    text,
    text
  )
to authenticated;

revoke all on function
  public.delete_def_transaction(uuid)
from public, anon;

grant execute on function
  public.delete_def_transaction(uuid)
to authenticated;

insert into public.fuel_transactions (
  user_id,
  expense_id,
  load_id,
  transaction_date,
  total_amount,
  location_name,
  notes,
  is_legacy
)
select
  expenses.user_id,
  expenses.id,
  expenses.load_id,
  expenses.expense_date,
  expenses.amount,
  expenses.vendor,
  expenses.notes,
  true
from public.expenses
where expenses.category = 'fuel'
on conflict (expense_id) do nothing;

alter table public.trucks
  enable row level security;

alter table public.fuel_transactions
  enable row level security;

alter table public.def_transactions
  enable row level security;

revoke all on table public.trucks
from anon;

revoke all on table public.fuel_transactions
from anon;

revoke all on table public.def_transactions
from anon;

grant select, insert, update, delete
on table public.trucks
to authenticated;

grant select
on table public.fuel_transactions
to authenticated;

grant select
on table public.def_transactions
to authenticated;

drop policy if exists
  "trucks_select_own"
on public.trucks;

create policy
  "trucks_select_own"
on public.trucks
for select
to authenticated
using (
  (select auth.uid()) = user_id
);

drop policy if exists
  "trucks_insert_own"
on public.trucks;

create policy
  "trucks_insert_own"
on public.trucks
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
);

drop policy if exists
  "trucks_update_own"
on public.trucks;

create policy
  "trucks_update_own"
on public.trucks
for update
to authenticated
using (
  (select auth.uid()) = user_id
)
with check (
  (select auth.uid()) = user_id
);

drop policy if exists
  "trucks_delete_own"
on public.trucks;

create policy
  "trucks_delete_own"
on public.trucks
for delete
to authenticated
using (
  (select auth.uid()) = user_id
);

drop policy if exists
  "fuel_transactions_select_own"
on public.fuel_transactions;

create policy
  "fuel_transactions_select_own"
on public.fuel_transactions
for select
to authenticated
using (
  (select auth.uid()) = user_id
);

drop policy if exists
  "def_transactions_select_own"
on public.def_transactions;

create policy
  "def_transactions_select_own"
on public.def_transactions
for select
to authenticated
using (
  (select auth.uid()) = user_id
);

commit;
