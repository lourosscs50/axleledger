begin;

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references auth.users(id)
    on delete cascade,

  expense_id uuid unique
    references public.expenses(id)
    on delete restrict,

  truck_id uuid
    references public.trucks(id)
    on delete restrict,

  load_id uuid
    references public.loads(id)
    on delete set null,

  status text not null
    check (
      status in (
        'scheduled',
        'completed'
      )
    ),

  service_category text not null
    check (
      service_category in (
        'preventive',
        'repair',
        'tires',
        'inspection',
        'fluids',
        'brakes',
        'electrical',
        'engine',
        'transmission',
        'suspension',
        'emissions',
        'other',
        'legacy'
      )
    ),

  work_description text not null,
  vendor text,

  scheduled_date date,
  scheduled_odometer integer,

  completed_date date,
  odometer integer,

  parts_cost numeric(12, 2) not null default 0,
  labor_cost numeric(12, 2) not null default 0,
  tax_cost numeric(12, 2) not null default 0,
  other_cost numeric(12, 2) not null default 0,
  total_cost numeric(12, 2) not null default 0,

  next_service_date date,
  next_service_odometer integer,

  warranty_covered boolean not null default false,
  warranty_provider text,
  warranty_claim_number text,
  warranty_expiration_date date,
  warranty_expiration_odometer integer,

  notes text,
  is_legacy boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint maintenance_work_description_not_blank
    check (
      length(trim(work_description)) > 0
    ),

  constraint maintenance_vendor_not_blank
    check (
      vendor is null
      or length(trim(vendor)) > 0
    ),

  constraint maintenance_scheduled_odometer_valid
    check (
      scheduled_odometer is null
      or scheduled_odometer >= 0
    ),

  constraint maintenance_odometer_valid
    check (
      odometer is null
      or odometer >= 0
    ),

  constraint maintenance_next_service_odometer_valid
    check (
      next_service_odometer is null
      or next_service_odometer >= 0
    ),

  constraint maintenance_warranty_expiration_odometer_valid
    check (
      warranty_expiration_odometer is null
      or warranty_expiration_odometer >= 0
    ),

  constraint maintenance_costs_nonnegative
    check (
      parts_cost >= 0
      and labor_cost >= 0
      and tax_cost >= 0
      and other_cost >= 0
      and total_cost >= 0
    ),

  constraint maintenance_total_matches_breakdown
    check (
      total_cost = round(
        parts_cost
        + labor_cost
        + tax_cost
        + other_cost,
        2
      )
    ),

  constraint maintenance_truck_required
    check (
      is_legacy
      or truck_id is not null
    ),

  constraint maintenance_lifecycle_fields
    check (
      (
        status = 'scheduled'
        and completed_date is null
        and expense_id is null
        and parts_cost = 0
        and labor_cost = 0
        and tax_cost = 0
        and other_cost = 0
        and total_cost = 0
        and (
          scheduled_date is not null
          or scheduled_odometer is not null
        )
      )
      or (
        status = 'completed'
        and completed_date is not null
        and (
          (
            total_cost > 0
            and expense_id is not null
          )
          or (
            total_cost = 0
            and expense_id is null
          )
        )
      )
    ),

  constraint maintenance_next_odometer_after_service
    check (
      next_service_odometer is null
      or odometer is null
      or next_service_odometer > odometer
    ),

  constraint maintenance_next_date_after_service
    check (
      next_service_date is null
      or completed_date is null
      or next_service_date >= completed_date
    ),

  constraint maintenance_warranty_fields
    check (
      warranty_covered
      or (
        warranty_provider is null
        and warranty_claim_number is null
        and warranty_expiration_date is null
        and warranty_expiration_odometer is null
      )
    ),

  constraint maintenance_warranty_provider_not_blank
    check (
      warranty_provider is null
      or length(trim(warranty_provider)) > 0
    ),

  constraint maintenance_warranty_claim_not_blank
    check (
      warranty_claim_number is null
      or length(trim(warranty_claim_number)) > 0
    ),

  constraint maintenance_warranty_date_after_service
    check (
      warranty_expiration_date is null
      or completed_date is null
      or warranty_expiration_date >= completed_date
    ),

  constraint maintenance_warranty_odometer_after_service
    check (
      warranty_expiration_odometer is null
      or odometer is null
      or warranty_expiration_odometer >= odometer
    ),

  constraint maintenance_notes_not_blank
    check (
      notes is null
      or length(trim(notes)) > 0
    )
);

create index if not exists
  maintenance_records_user_status_idx
on public.maintenance_records (
  user_id,
  status,
  scheduled_date,
  completed_date desc
);

create index if not exists
  maintenance_records_user_truck_idx
on public.maintenance_records (
  user_id,
  truck_id,
  completed_date desc,
  scheduled_date
);

create index if not exists
  maintenance_records_user_load_idx
on public.maintenance_records (
  user_id,
  load_id
)
where load_id is not null;

drop trigger if exists
  maintenance_records_set_updated_at
on public.maintenance_records;

create trigger
  maintenance_records_set_updated_at
before update
on public.maintenance_records
for each row
execute function public.set_updated_at();

insert into public.maintenance_records (
  user_id,
  expense_id,
  truck_id,
  load_id,
  status,
  service_category,
  work_description,
  vendor,
  completed_date,
  other_cost,
  total_cost,
  notes,
  is_legacy,
  created_at,
  updated_at
)
select
  expense.user_id,
  expense.id,
  case
    when (
      select count(*)
      from public.trucks as truck_count
      where truck_count.user_id = expense.user_id
    ) = 1
    then (
      select truck_single.id
      from public.trucks as truck_single
      where truck_single.user_id = expense.user_id
      limit 1
    )
    else null
  end,
  expense.load_id,
  'completed',
  'legacy',
  coalesce(
    nullif(trim(expense.notes), ''),
    'Imported V1 maintenance expense'
  ),
  expense.vendor,
  expense.expense_date,
  expense.amount,
  expense.amount,
  expense.notes,
  true,
  expense.created_at,
  expense.updated_at
from public.expenses as expense
where expense.category = 'maintenance'
on conflict (expense_id) do nothing;

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
      or exists (
        select 1
        from public.maintenance_records
        where expense_id = old.id
      )
    )
  then
    raise exception using
      errcode = '23514',
      message =
        'Structured fuel, DEF, and maintenance expenses must be managed from their operations pages.';
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

create or replace function
  public.create_maintenance_record(
    p_truck_id uuid,
    p_load_id uuid,
    p_status text,
    p_service_category text,
    p_work_description text,
    p_vendor text,
    p_scheduled_date date,
    p_scheduled_odometer integer,
    p_completed_date date,
    p_odometer integer,
    p_parts_cost numeric,
    p_labor_cost numeric,
    p_tax_cost numeric,
    p_other_cost numeric,
    p_next_service_date date,
    p_next_service_odometer integer,
    p_warranty_covered boolean,
    p_warranty_provider text,
    p_warranty_claim_number text,
    p_warranty_expiration_date date,
    p_warranty_expiration_odometer integer,
    p_notes text
  )
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_record_id uuid;
  v_expense_id uuid;
  v_total numeric(12, 2);
  v_description text :=
    nullif(trim(coalesce(p_work_description, '')), '');
  v_vendor text :=
    nullif(trim(coalesce(p_vendor, '')), '');
  v_notes text :=
    nullif(trim(coalesce(p_notes, '')), '');
  v_warranty_provider text :=
    nullif(trim(coalesce(p_warranty_provider, '')), '');
  v_warranty_claim_number text :=
    nullif(trim(coalesce(p_warranty_claim_number, '')), '');
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

  if p_status not in (
    'scheduled',
    'completed'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Select a valid maintenance status.';
  end if;

  if p_service_category not in (
    'preventive',
    'repair',
    'tires',
    'inspection',
    'fluids',
    'brakes',
    'electrical',
    'engine',
    'transmission',
    'suspension',
    'emissions',
    'other'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Select a valid service category.';
  end if;

  if v_description is null then
    raise exception using
      errcode = '23514',
      message = 'Work description is required.';
  end if;

  if coalesce(p_scheduled_odometer, 0) < 0
    or coalesce(p_odometer, 0) < 0
    or coalesce(p_next_service_odometer, 0) < 0
    or coalesce(p_warranty_expiration_odometer, 0) < 0
    or coalesce(p_parts_cost, 0) < 0
    or coalesce(p_labor_cost, 0) < 0
    or coalesce(p_tax_cost, 0) < 0
    or coalesce(p_other_cost, 0) < 0
  then
    raise exception using
      errcode = '23514',
      message =
        'Maintenance mileage and cost values must be zero or greater.';
  end if;

  v_total := round(
    coalesce(p_parts_cost, 0)
    + coalesce(p_labor_cost, 0)
    + coalesce(p_tax_cost, 0)
    + coalesce(p_other_cost, 0),
    2
  );

  if p_status = 'scheduled' then
    if p_scheduled_date is null
      and p_scheduled_odometer is null
    then
      raise exception using
        errcode = '23514',
        message =
          'Scheduled maintenance requires a due date or odometer target.';
    end if;

    if p_completed_date is not null
      or v_total <> 0
      or p_next_service_date is not null
      or p_next_service_odometer is not null
      or coalesce(p_warranty_covered, false)
    then
      raise exception using
        errcode = '23514',
        message =
          'Completion costs, next-service targets, and warranty details belong on completed maintenance.';
    end if;
  else
    if p_completed_date is null then
      raise exception using
        errcode = '23514',
        message =
          'Completed maintenance requires a completion date.';
    end if;

    if p_next_service_odometer is not null
      and p_odometer is not null
      and p_next_service_odometer <= p_odometer
    then
      raise exception using
        errcode = '23514',
        message =
          'Next-service odometer must be greater than the service odometer.';
    end if;

    if p_next_service_date is not null
      and p_next_service_date < p_completed_date
    then
      raise exception using
        errcode = '23514',
        message =
          'Next-service date cannot be before the completion date.';
    end if;

    if coalesce(p_warranty_covered, false)
      and p_warranty_expiration_date is not null
      and p_warranty_expiration_date < p_completed_date
    then
      raise exception using
        errcode = '23514',
        message =
          'Warranty expiration date cannot be before the completion date.';
    end if;

    if coalesce(p_warranty_covered, false)
      and p_warranty_expiration_odometer is not null
      and p_odometer is not null
      and p_warranty_expiration_odometer < p_odometer
    then
      raise exception using
        errcode = '23514',
        message =
          'Warranty expiration odometer cannot be below the service odometer.';
    end if;

    if v_total > 0 then
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
        'maintenance',
        v_total,
        p_completed_date,
        v_vendor,
        v_notes
      )
      returning id into v_expense_id;
    end if;
  end if;

  insert into public.maintenance_records (
    user_id,
    expense_id,
    truck_id,
    load_id,
    status,
    service_category,
    work_description,
    vendor,
    scheduled_date,
    scheduled_odometer,
    completed_date,
    odometer,
    parts_cost,
    labor_cost,
    tax_cost,
    other_cost,
    total_cost,
    next_service_date,
    next_service_odometer,
    warranty_covered,
    warranty_provider,
    warranty_claim_number,
    warranty_expiration_date,
    warranty_expiration_odometer,
    notes
  )
  values (
    v_user_id,
    v_expense_id,
    p_truck_id,
    p_load_id,
    p_status,
    p_service_category,
    v_description,
    v_vendor,
    p_scheduled_date,
    p_scheduled_odometer,
    p_completed_date,
    p_odometer,
    case
      when p_status = 'completed'
      then round(coalesce(p_parts_cost, 0), 2)
      else 0
    end,
    case
      when p_status = 'completed'
      then round(coalesce(p_labor_cost, 0), 2)
      else 0
    end,
    case
      when p_status = 'completed'
      then round(coalesce(p_tax_cost, 0), 2)
      else 0
    end,
    case
      when p_status = 'completed'
      then round(coalesce(p_other_cost, 0), 2)
      else 0
    end,
    case
      when p_status = 'completed'
      then v_total
      else 0
    end,
    case
      when p_status = 'completed'
      then p_next_service_date
      else null
    end,
    case
      when p_status = 'completed'
      then p_next_service_odometer
      else null
    end,
    case
      when p_status = 'completed'
      then coalesce(p_warranty_covered, false)
      else false
    end,
    case
      when p_status = 'completed'
        and coalesce(p_warranty_covered, false)
      then v_warranty_provider
      else null
    end,
    case
      when p_status = 'completed'
        and coalesce(p_warranty_covered, false)
      then v_warranty_claim_number
      else null
    end,
    case
      when p_status = 'completed'
        and coalesce(p_warranty_covered, false)
      then p_warranty_expiration_date
      else null
    end,
    case
      when p_status = 'completed'
        and coalesce(p_warranty_covered, false)
      then p_warranty_expiration_odometer
      else null
    end,
    v_notes
  )
  returning id into v_record_id;

  return v_record_id;
end;
$$;

create or replace function
  public.update_maintenance_record(
    p_record_id uuid,
    p_truck_id uuid,
    p_load_id uuid,
    p_status text,
    p_service_category text,
    p_work_description text,
    p_vendor text,
    p_scheduled_date date,
    p_scheduled_odometer integer,
    p_completed_date date,
    p_odometer integer,
    p_parts_cost numeric,
    p_labor_cost numeric,
    p_tax_cost numeric,
    p_other_cost numeric,
    p_next_service_date date,
    p_next_service_odometer integer,
    p_warranty_covered boolean,
    p_warranty_provider text,
    p_warranty_claim_number text,
    p_warranty_expiration_date date,
    p_warranty_expiration_odometer integer,
    p_notes text
  )
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_status text;
  v_existing_expense_id uuid;
  v_is_legacy boolean;
  v_expense_id uuid;
  v_total numeric(12, 2);
  v_description text :=
    nullif(trim(coalesce(p_work_description, '')), '');
  v_vendor text :=
    nullif(trim(coalesce(p_vendor, '')), '');
  v_notes text :=
    nullif(trim(coalesce(p_notes, '')), '');
  v_warranty_provider text :=
    nullif(trim(coalesce(p_warranty_provider, '')), '');
  v_warranty_claim_number text :=
    nullif(trim(coalesce(p_warranty_claim_number, '')), '');
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  select
    status,
    expense_id,
    is_legacy
  into
    v_existing_status,
    v_existing_expense_id,
    v_is_legacy
  from public.maintenance_records
  where id = p_record_id
    and user_id = v_user_id
  for update;

  if v_existing_status is null then
    raise exception using
      errcode = 'P0002',
      message = 'Maintenance record was not found.';
  end if;

  if p_truck_id is null
    and not v_is_legacy
  then
    raise exception using
      errcode = '23514',
      message = 'Select a valid truck.';
  end if;

  if p_truck_id is not null
    and not exists (
      select 1
      from public.trucks
      where id = p_truck_id
        and user_id = v_user_id
    )
  then
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

  if p_status not in (
    'scheduled',
    'completed'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Select a valid maintenance status.';
  end if;

  if v_existing_status = 'completed'
    and p_status <> 'completed'
  then
    raise exception using
      errcode = '23514',
      message =
        'Completed maintenance cannot return to scheduled status.';
  end if;

  if p_service_category not in (
    'preventive',
    'repair',
    'tires',
    'inspection',
    'fluids',
    'brakes',
    'electrical',
    'engine',
    'transmission',
    'suspension',
    'emissions',
    'other',
    'legacy'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Select a valid service category.';
  end if;

  if p_service_category = 'legacy'
    and not v_is_legacy
  then
    raise exception using
      errcode = '23514',
      message = 'Legacy category is reserved for imported records.';
  end if;

  if v_description is null then
    raise exception using
      errcode = '23514',
      message = 'Work description is required.';
  end if;

  if coalesce(p_scheduled_odometer, 0) < 0
    or coalesce(p_odometer, 0) < 0
    or coalesce(p_next_service_odometer, 0) < 0
    or coalesce(p_warranty_expiration_odometer, 0) < 0
    or coalesce(p_parts_cost, 0) < 0
    or coalesce(p_labor_cost, 0) < 0
    or coalesce(p_tax_cost, 0) < 0
    or coalesce(p_other_cost, 0) < 0
  then
    raise exception using
      errcode = '23514',
      message =
        'Maintenance mileage and cost values must be zero or greater.';
  end if;

  v_total := round(
    coalesce(p_parts_cost, 0)
    + coalesce(p_labor_cost, 0)
    + coalesce(p_tax_cost, 0)
    + coalesce(p_other_cost, 0),
    2
  );

  if p_status = 'scheduled' then
    if p_scheduled_date is null
      and p_scheduled_odometer is null
    then
      raise exception using
        errcode = '23514',
        message =
          'Scheduled maintenance requires a due date or odometer target.';
    end if;

    if p_completed_date is not null
      or v_total <> 0
      or p_next_service_date is not null
      or p_next_service_odometer is not null
      or coalesce(p_warranty_covered, false)
    then
      raise exception using
        errcode = '23514',
        message =
          'Completion costs, next-service targets, and warranty details belong on completed maintenance.';
    end if;
  else
    if p_completed_date is null then
      raise exception using
        errcode = '23514',
        message =
          'Completed maintenance requires a completion date.';
    end if;

    if p_next_service_odometer is not null
      and p_odometer is not null
      and p_next_service_odometer <= p_odometer
    then
      raise exception using
        errcode = '23514',
        message =
          'Next-service odometer must be greater than the service odometer.';
    end if;

    if p_next_service_date is not null
      and p_next_service_date < p_completed_date
    then
      raise exception using
        errcode = '23514',
        message =
          'Next-service date cannot be before the completion date.';
    end if;

    if coalesce(p_warranty_covered, false)
      and p_warranty_expiration_date is not null
      and p_warranty_expiration_date < p_completed_date
    then
      raise exception using
        errcode = '23514',
        message =
          'Warranty expiration date cannot be before the completion date.';
    end if;

    if coalesce(p_warranty_covered, false)
      and p_warranty_expiration_odometer is not null
      and p_odometer is not null
      and p_warranty_expiration_odometer < p_odometer
    then
      raise exception using
        errcode = '23514',
        message =
          'Warranty expiration odometer cannot be below the service odometer.';
    end if;
  end if;

  v_expense_id := v_existing_expense_id;

  perform set_config(
    'axleledger.structured_expense_write',
    'on',
    true
  );

  if p_status = 'completed'
    and v_total > 0
  then
    if v_expense_id is null then
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
        'maintenance',
        v_total,
        p_completed_date,
        v_vendor,
        v_notes
      )
      returning id into v_expense_id;
    else
      update public.expenses
      set
        load_id = p_load_id,
        category = 'maintenance',
        amount = v_total,
        expense_date = p_completed_date,
        vendor = v_vendor,
        notes = v_notes
      where id = v_expense_id
        and user_id = v_user_id;
    end if;
  else
    v_expense_id := null;
  end if;

  update public.maintenance_records
  set
    expense_id = v_expense_id,
    truck_id = p_truck_id,
    load_id = p_load_id,
    status = p_status,
    service_category = p_service_category,
    work_description = v_description,
    vendor = v_vendor,
    scheduled_date = p_scheduled_date,
    scheduled_odometer = p_scheduled_odometer,
    completed_date = case
      when p_status = 'completed'
      then p_completed_date
      else null
    end,
    odometer = case
      when p_status = 'completed'
      then p_odometer
      else null
    end,
    parts_cost = case
      when p_status = 'completed'
      then round(coalesce(p_parts_cost, 0), 2)
      else 0
    end,
    labor_cost = case
      when p_status = 'completed'
      then round(coalesce(p_labor_cost, 0), 2)
      else 0
    end,
    tax_cost = case
      when p_status = 'completed'
      then round(coalesce(p_tax_cost, 0), 2)
      else 0
    end,
    other_cost = case
      when p_status = 'completed'
      then round(coalesce(p_other_cost, 0), 2)
      else 0
    end,
    total_cost = case
      when p_status = 'completed'
      then v_total
      else 0
    end,
    next_service_date = case
      when p_status = 'completed'
      then p_next_service_date
      else null
    end,
    next_service_odometer = case
      when p_status = 'completed'
      then p_next_service_odometer
      else null
    end,
    warranty_covered = case
      when p_status = 'completed'
      then coalesce(p_warranty_covered, false)
      else false
    end,
    warranty_provider = case
      when p_status = 'completed'
        and coalesce(p_warranty_covered, false)
      then v_warranty_provider
      else null
    end,
    warranty_claim_number = case
      when p_status = 'completed'
        and coalesce(p_warranty_covered, false)
      then v_warranty_claim_number
      else null
    end,
    warranty_expiration_date = case
      when p_status = 'completed'
        and coalesce(p_warranty_covered, false)
      then p_warranty_expiration_date
      else null
    end,
    warranty_expiration_odometer = case
      when p_status = 'completed'
        and coalesce(p_warranty_covered, false)
      then p_warranty_expiration_odometer
      else null
    end,
    notes = v_notes
  where id = p_record_id
    and user_id = v_user_id;

  if v_existing_expense_id is not null
    and v_expense_id is null
  then
    delete from public.expenses
    where id = v_existing_expense_id
      and user_id = v_user_id;
  end if;
end;
$$;

create or replace function
  public.delete_maintenance_record(
    p_record_id uuid
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
  from public.maintenance_records
  where id = p_record_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Maintenance record was not found.';
  end if;

  perform set_config(
    'axleledger.structured_expense_write',
    'on',
    true
  );

  delete from public.maintenance_records
  where id = p_record_id
    and user_id = v_user_id;

  if v_expense_id is not null then
    delete from public.expenses
    where id = v_expense_id
      and user_id = v_user_id;
  end if;
end;
$$;

revoke all on function
  public.create_maintenance_record(
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    date,
    integer,
    date,
    integer,
    numeric,
    numeric,
    numeric,
    numeric,
    date,
    integer,
    boolean,
    text,
    text,
    date,
    integer,
    text
  )
from public, anon;

grant execute on function
  public.create_maintenance_record(
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    date,
    integer,
    date,
    integer,
    numeric,
    numeric,
    numeric,
    numeric,
    date,
    integer,
    boolean,
    text,
    text,
    date,
    integer,
    text
  )
to authenticated;

revoke all on function
  public.update_maintenance_record(
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    date,
    integer,
    date,
    integer,
    numeric,
    numeric,
    numeric,
    numeric,
    date,
    integer,
    boolean,
    text,
    text,
    date,
    integer,
    text
  )
from public, anon;

grant execute on function
  public.update_maintenance_record(
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    date,
    integer,
    date,
    integer,
    numeric,
    numeric,
    numeric,
    numeric,
    date,
    integer,
    boolean,
    text,
    text,
    date,
    integer,
    text
  )
to authenticated;

revoke all on function
  public.delete_maintenance_record(uuid)
from public, anon;

grant execute on function
  public.delete_maintenance_record(uuid)
to authenticated;

alter table public.maintenance_records
  enable row level security;

revoke all on table public.maintenance_records
from anon;

grant select
on table public.maintenance_records
to authenticated;

drop policy if exists
  "maintenance_records_select_own"
on public.maintenance_records;

create policy
  "maintenance_records_select_own"
on public.maintenance_records
for select
to authenticated
using (
  (select auth.uid()) = user_id
);

commit;
