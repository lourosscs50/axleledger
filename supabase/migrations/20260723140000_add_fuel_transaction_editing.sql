begin;

create or replace function
  public.update_fuel_transaction(
    p_transaction_id uuid,
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
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense_id uuid;
  v_is_legacy boolean;
  v_old_total numeric(12, 2);
  v_new_total numeric(12, 2);
  v_net_price numeric(8, 4);
  v_vendor text;
  v_description text;
  v_settlement_id uuid;
  v_settlement_status text;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  select
    expense_id,
    is_legacy,
    total_amount
  into
    v_expense_id,
    v_is_legacy,
    v_old_total
  from public.fuel_transactions
  where id = p_transaction_id
    and user_id = v_user_id;

  if v_expense_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Fuel transaction was not found.';
  end if;

  if v_is_legacy then
    raise exception using
      errcode = '23514',
      message =
        'Legacy fuel imports cannot be edited because their original gallons and pricing details were not available.';
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
    or p_discount_per_gallon >=
      p_pump_price_per_gallon
    or p_total_amount <= 0
  then
    raise exception using
      errcode = '23514',
      message =
        'Fuel quantities and prices are invalid.';
  end if;

  if p_odometer is not null
    and p_odometer < 0
  then
    raise exception using
      errcode = '23514',
      message =
        'Odometer must be zero or greater.';
  end if;

  if nullif(
    upper(trim(coalesce(p_state, ''))),
    ''
  ) is not null
    and upper(trim(p_state)) !~ '^[A-Z]{2}$'
  then
    raise exception using
      errcode = '23514',
      message =
        'State must contain a two-letter abbreviation.';
  end if;

  select
    line_item.settlement_id,
    settlement.status
  into
    v_settlement_id,
    v_settlement_status
  from public.settlement_line_items
    as line_item
  join public.settlements as settlement
    on settlement.id =
      line_item.settlement_id
   and settlement.user_id =
      line_item.user_id
  where line_item.expense_id =
      v_expense_id
    and line_item.user_id = v_user_id
  limit 1;

  if v_settlement_status is not null
    and v_settlement_status not in (
      'draft',
      'reopened'
    )
  then
    raise exception using
      errcode = '23514',
      message =
        'This fuel expense is linked to a locked settlement. Return or reopen the settlement before editing the fuel transaction.';
  end if;

  v_new_total := round(p_total_amount, 2);

  v_net_price := round(
    p_pump_price_per_gallon
    - p_discount_per_gallon,
    4
  );

  v_vendor := nullif(
    trim(
      coalesce(
        p_location_name,
        p_network,
        ''
      )
    ),
    ''
  );

  v_description :=
    coalesce(v_vendor, 'Fuel expense')
    || ' · '
    || to_char(
      p_transaction_date,
      'Mon DD, YYYY'
    );

  perform set_config(
    'axleledger.structured_expense_write',
    'on',
    true
  );

  perform set_config(
    'axleledger.settlement_internal_write',
    'on',
    true
  );

  perform set_config(
    'axleledger.settlement_expense_link_write',
    'on',
    true
  );

  update public.expenses
  set
    load_id = p_load_id,
    amount = v_new_total,
    expense_date = p_transaction_date,
    vendor = v_vendor,
    notes = nullif(
      trim(coalesce(p_notes, '')),
      ''
    )
  where id = v_expense_id
    and user_id = v_user_id;

  update public.fuel_transactions
  set
    truck_id = p_truck_id,
    load_id = p_load_id,
    transaction_date = p_transaction_date,
    transaction_time = p_transaction_time,
    odometer = p_odometer,
    gallons = round(p_gallons, 3),
    pump_price_per_gallon = round(
      p_pump_price_per_gallon,
      4
    ),
    discount_per_gallon = round(
      p_discount_per_gallon,
      4
    ),
    net_price_per_gallon = v_net_price,
    total_amount = v_new_total,
    network = nullif(
      trim(coalesce(p_network, '')),
      ''
    ),
    location_name = nullif(
      trim(
        coalesce(p_location_name, '')
      ),
      ''
    ),
    city = nullif(
      trim(coalesce(p_city, '')),
      ''
    ),
    state = nullif(
      upper(trim(coalesce(p_state, ''))),
      ''
    ),
    notes = nullif(
      trim(coalesce(p_notes, '')),
      ''
    )
  where id = p_transaction_id
    and user_id = v_user_id;

  if v_settlement_id is not null then
    update public.settlement_line_items
    set
      load_id = p_load_id,
      category = 'fuel',
      description = v_description,
      amount = case
        when amount = source_amount
          then v_new_total
        else amount
      end,
      source_amount = v_new_total,
      variance_reason = case
        when amount = source_amount
          then null
        else variance_reason
      end,
      updated_at = now()
    where expense_id = v_expense_id
      and user_id = v_user_id;

    insert into public.settlement_audit_events (
      user_id,
      settlement_id,
      event_type,
      from_status,
      to_status,
      details
    )
    values (
      v_user_id,
      v_settlement_id,
      'linked_fuel_source_updated',
      v_settlement_status,
      v_settlement_status,
      jsonb_build_object(
        'transaction_id',
          p_transaction_id,
        'expense_id', v_expense_id,
        'old_source_amount',
          round(v_old_total, 2),
        'new_source_amount',
          v_new_total
      )
    );
  end if;
end;
$$;

create or replace function
  public.update_def_transaction(
    p_transaction_id uuid,
    p_truck_id uuid,
    p_load_id uuid,
    p_transaction_date date,
    p_transaction_time time,
    p_odometer integer,
    p_gallons numeric,
    p_total_amount numeric,
    p_network text,
    p_location_name text,
    p_city text,
    p_state text,
    p_notes text,
    p_price_per_gallon numeric
  )
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense_id uuid;
  v_old_total numeric(12, 2);
  v_new_total numeric(12, 2);
  v_vendor text;
  v_description text;
  v_settlement_id uuid;
  v_settlement_status text;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  select
    expense_id,
    total_amount
  into
    v_expense_id,
    v_old_total
  from public.def_transactions
  where id = p_transaction_id
    and user_id = v_user_id;

  if v_expense_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'DEF transaction was not found.';
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
      message =
        'DEF quantities and prices are invalid.';
  end if;

  if p_odometer is not null
    and p_odometer < 0
  then
    raise exception using
      errcode = '23514',
      message =
        'Odometer must be zero or greater.';
  end if;

  if nullif(
    upper(trim(coalesce(p_state, ''))),
    ''
  ) is not null
    and upper(trim(p_state)) !~ '^[A-Z]{2}$'
  then
    raise exception using
      errcode = '23514',
      message =
        'State must contain a two-letter abbreviation.';
  end if;

  select
    line_item.settlement_id,
    settlement.status
  into
    v_settlement_id,
    v_settlement_status
  from public.settlement_line_items
    as line_item
  join public.settlements as settlement
    on settlement.id =
      line_item.settlement_id
   and settlement.user_id =
      line_item.user_id
  where line_item.expense_id =
      v_expense_id
    and line_item.user_id = v_user_id
  limit 1;

  if v_settlement_status is not null
    and v_settlement_status not in (
      'draft',
      'reopened'
    )
  then
    raise exception using
      errcode = '23514',
      message =
        'This DEF expense is linked to a locked settlement. Return or reopen the settlement before editing the DEF transaction.';
  end if;

  v_new_total := round(p_total_amount, 2);

  v_vendor := nullif(
    trim(
      coalesce(
        p_location_name,
        p_network,
        ''
      )
    ),
    ''
  );

  v_description :=
    coalesce(v_vendor, 'DEF expense')
    || ' · '
    || to_char(
      p_transaction_date,
      'Mon DD, YYYY'
    );

  perform set_config(
    'axleledger.structured_expense_write',
    'on',
    true
  );

  perform set_config(
    'axleledger.settlement_internal_write',
    'on',
    true
  );

  perform set_config(
    'axleledger.settlement_expense_link_write',
    'on',
    true
  );

  update public.expenses
  set
    load_id = p_load_id,
    amount = v_new_total,
    expense_date = p_transaction_date,
    vendor = v_vendor,
    notes = nullif(
      trim(coalesce(p_notes, '')),
      ''
    )
  where id = v_expense_id
    and user_id = v_user_id;

  update public.def_transactions
  set
    truck_id = p_truck_id,
    load_id = p_load_id,
    transaction_date = p_transaction_date,
    transaction_time = p_transaction_time,
    odometer = p_odometer,
    gallons = round(p_gallons, 3),
    price_per_gallon = round(
      p_price_per_gallon,
      4
    ),
    total_amount = v_new_total,
    network = nullif(
      trim(coalesce(p_network, '')),
      ''
    ),
    location_name = nullif(
      trim(
        coalesce(p_location_name, '')
      ),
      ''
    ),
    city = nullif(
      trim(coalesce(p_city, '')),
      ''
    ),
    state = nullif(
      upper(trim(coalesce(p_state, ''))),
      ''
    ),
    notes = nullif(
      trim(coalesce(p_notes, '')),
      ''
    )
  where id = p_transaction_id
    and user_id = v_user_id;

  if v_settlement_id is not null then
    update public.settlement_line_items
    set
      load_id = p_load_id,
      category = 'def',
      description = v_description,
      amount = case
        when amount = source_amount
          then v_new_total
        else amount
      end,
      source_amount = v_new_total,
      variance_reason = case
        when amount = source_amount
          then null
        else variance_reason
      end,
      updated_at = now()
    where expense_id = v_expense_id
      and user_id = v_user_id;

    insert into public.settlement_audit_events (
      user_id,
      settlement_id,
      event_type,
      from_status,
      to_status,
      details
    )
    values (
      v_user_id,
      v_settlement_id,
      'linked_def_source_updated',
      v_settlement_status,
      v_settlement_status,
      jsonb_build_object(
        'transaction_id',
          p_transaction_id,
        'expense_id', v_expense_id,
        'old_source_amount',
          round(v_old_total, 2),
        'new_source_amount',
          v_new_total
      )
    );
  end if;
end;
$$;

revoke all on function
  public.update_fuel_transaction(
    uuid,
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
  public.update_fuel_transaction(
    uuid,
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
  public.update_def_transaction(
    uuid,
    uuid,
    uuid,
    date,
    time,
    integer,
    numeric,
    numeric,
    text,
    text,
    text,
    text,
    text,
    numeric
  )
from public, anon;

grant execute on function
  public.update_def_transaction(
    uuid,
    uuid,
    uuid,
    date,
    time,
    integer,
    numeric,
    numeric,
    text,
    text,
    text,
    text,
    text,
    numeric
  )
to authenticated;

commit;
