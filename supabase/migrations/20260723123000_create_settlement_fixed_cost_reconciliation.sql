begin;

alter table public.fixed_costs
  drop constraint if exists
    fixed_costs_category_check;

alter table public.fixed_costs
  add constraint fixed_costs_category_check
  check (
    category in (
      'truck_payment',
      'trailer_lease',
      'insurance',
      'permits',
      'communications',
      'subscriptions',
      'other'
    )
  );

alter table public.settlement_line_items
  add column if not exists fixed_cost_id uuid
    references public.fixed_costs(id)
    on delete restrict;

alter table public.settlement_line_items
  drop constraint if exists
    settlement_line_items_expense_source_valid;

alter table public.settlement_line_items
  drop constraint if exists
    settlement_line_items_source_valid;

alter table public.settlement_line_items
  add constraint
    settlement_line_items_source_valid
  check (
    (
      expense_id is null
      and fixed_cost_id is null
      and source_type is null
      and source_amount is null
      and variance_reason is null
    )
    or (
      expense_id is not null
      and fixed_cost_id is null
      and kind = 'deduction'
      and source_type = 'expense'
      and source_amount is not null
      and source_amount > 0
      and (
        amount = source_amount
        or (
          variance_reason is not null
          and length(trim(variance_reason)) > 0
        )
      )
    )
    or (
      expense_id is null
      and fixed_cost_id is not null
      and load_id is null
      and kind = 'deduction'
      and source_type = 'fixed_cost'
      and source_amount is not null
      and source_amount > 0
      and (
        amount = source_amount
        or (
          variance_reason is not null
          and length(trim(variance_reason)) > 0
        )
      )
    )
  );

create unique index if not exists
  settlement_line_items_settlement_fixed_cost_unique
on public.settlement_line_items (
  settlement_id,
  fixed_cost_id
)
where fixed_cost_id is not null;

create index if not exists
  settlement_line_items_user_fixed_cost_idx
on public.settlement_line_items (
  user_id,
  fixed_cost_id
)
where fixed_cost_id is not null;

create or replace function
  public.calculate_settlement_fixed_cost_source_amount(
    p_fixed_cost_id uuid,
    p_settlement_id uuid,
    p_user_id uuid
  )
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount numeric(12, 2);
  v_frequency text;
  v_effective_date date;
  v_settlement_date date;
  v_period_start date;
  v_period_end date;
  v_effective_start date;
  v_days integer;
  v_divisor numeric;
  v_source_amount numeric(12, 2);
begin
  select
    amount,
    frequency,
    effective_date
  into
    v_amount,
    v_frequency,
    v_effective_date
  from public.fixed_costs
  where id = p_fixed_cost_id
    and user_id = p_user_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Fixed cost was not found.';
  end if;

  select
    settlement_date,
    period_start_date,
    period_end_date
  into
    v_settlement_date,
    v_period_start,
    v_period_end
  from public.settlements
  where id = p_settlement_id
    and user_id = p_user_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Settlement was not found.';
  end if;

  if v_period_start is not null
    and v_period_end is not null
  then
    if v_effective_date > v_period_end then
      raise exception using
        errcode = '23514',
        message =
          'That fixed cost was not effective during the settlement period.';
    end if;

    v_effective_start := greatest(
      v_effective_date,
      v_period_start
    );

    v_days :=
      (v_period_end - v_effective_start) + 1;

    v_divisor :=
      case v_frequency
        when 'weekly' then 7
        else 30.4375
      end;

    v_source_amount := round(
      v_amount * (v_days / v_divisor),
      2
    );
  else
    if v_effective_date > v_settlement_date then
      raise exception using
        errcode = '23514',
        message =
          'That fixed cost was not effective by the settlement date.';
    end if;

    v_source_amount := round(v_amount, 2);
  end if;

  if v_source_amount <= 0 then
    raise exception using
      errcode = '23514',
      message =
        'The expected fixed-cost amount must be greater than zero.';
  end if;

  return v_source_amount;
end;
$$;

revoke execute on function
  public.calculate_settlement_fixed_cost_source_amount(
    uuid,
    uuid,
    uuid
  )
from public, anon, authenticated;

create or replace function
  public.validate_settlement_child_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settlement_id uuid;
  v_user_id uuid;
  v_load_id uuid;
  v_expense_id uuid;
  v_fixed_cost_id uuid;
  v_status text;
  v_expense_amount numeric(12, 2);
  v_fixed_cost_amount numeric(12, 2);
  v_internal_write boolean;
  v_expense_link_write boolean;
  v_fixed_cost_link_write boolean;
begin
  if tg_op = 'DELETE' then
    v_settlement_id := old.settlement_id;
    v_user_id := old.user_id;
    v_load_id := old.load_id;
    v_expense_id := old.expense_id;
    v_fixed_cost_id := old.fixed_cost_id;
  else
    v_settlement_id := new.settlement_id;
    v_user_id := new.user_id;
    v_load_id := new.load_id;
    v_expense_id := new.expense_id;
    v_fixed_cost_id := new.fixed_cost_id;
  end if;

  v_internal_write :=
    coalesce(
      current_setting(
        'axleledger.settlement_internal_write',
        true
      ),
      'off'
    ) = 'on';

  v_expense_link_write :=
    coalesce(
      current_setting(
        'axleledger.settlement_expense_link_write',
        true
      ),
      'off'
    ) = 'on';

  v_fixed_cost_link_write :=
    coalesce(
      current_setting(
        'axleledger.settlement_fixed_cost_link_write',
        true
      ),
      'off'
    ) = 'on';

  if auth.uid() is not null
    and not v_internal_write
  then
    select status
    into v_status
    from public.settlements
    where id = v_settlement_id
      and user_id = v_user_id;

    if v_status is null then
      raise exception using
        errcode = '23514',
        message = 'Select a valid settlement.';
    end if;

    if v_status not in ('draft', 'reopened') then
      raise exception using
        errcode = '23514',
        message =
          'Settlement details can only change while draft or reopened.';
    end if;
  end if;

  if v_load_id is not null
    and not exists (
      select 1
      from public.loads
      where id = v_load_id
        and user_id = v_user_id
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Select a valid load.';
  end if;

  if v_expense_id is not null then
    if auth.uid() is not null
      and not v_internal_write
      and not v_expense_link_write
    then
      raise exception using
        errcode = '23514',
        message =
          'Linked expense lines must be managed from settlement expense reconciliation.';
    end if;

    if tg_op <> 'DELETE' then
      select amount
      into v_expense_amount
      from public.expenses
      where id = v_expense_id
        and user_id = v_user_id;

      if v_expense_amount is null then
        raise exception using
          errcode = '23514',
          message =
            'Select a valid operating expense.';
      end if;

      if new.kind <> 'deduction'
        or new.source_type <> 'expense'
        or new.fixed_cost_id is not null
        or new.source_amount is distinct from
          round(v_expense_amount, 2)
      then
        raise exception using
          errcode = '23514',
          message =
            'Linked expense reconciliation values are invalid.';
      end if;

      if round(new.amount, 2)
          <> round(v_expense_amount, 2)
        and nullif(
          trim(
            coalesce(
              new.variance_reason,
              ''
            )
          ),
          ''
        ) is null
      then
        raise exception using
          errcode = '23514',
          message =
            'A variance reason is required when the statement deduction differs from the expense ledger.';
      end if;
    end if;
  end if;

  if v_fixed_cost_id is not null then
    if auth.uid() is not null
      and not v_internal_write
      and not v_fixed_cost_link_write
    then
      raise exception using
        errcode = '23514',
        message =
          'Linked fixed-cost lines must be managed from settlement fixed-cost reconciliation.';
    end if;

    if tg_op <> 'DELETE' then
      v_fixed_cost_amount :=
        public.calculate_settlement_fixed_cost_source_amount(
          v_fixed_cost_id,
          v_settlement_id,
          v_user_id
        );

      if new.kind <> 'deduction'
        or new.source_type <> 'fixed_cost'
        or new.expense_id is not null
        or new.load_id is not null
        or new.source_amount is distinct from
          v_fixed_cost_amount
      then
        raise exception using
          errcode = '23514',
          message =
            'Linked fixed-cost reconciliation values are invalid.';
      end if;

      if round(new.amount, 2)
          <> v_fixed_cost_amount
        and nullif(
          trim(
            coalesce(
              new.variance_reason,
              ''
            )
          ),
          ''
        ) is null
      then
        raise exception using
          errcode = '23514',
          message =
            'A variance reason is required when the statement deduction differs from the expected fixed cost.';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke execute on function
  public.validate_settlement_child_mutation()
from public, anon, authenticated;

create or replace function
  public.link_settlement_fixed_costs(
    p_settlement_id uuid,
    p_links jsonb
  )
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_link jsonb;
  v_fixed_cost public.fixed_costs%rowtype;
  v_fixed_cost_id uuid;
  v_source_amount numeric(12, 2);
  v_statement_amount numeric(12, 2);
  v_variance_reason text;
  v_description text;
  v_linked_count integer := 0;
  v_linked_fixed_cost_ids jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  select status
  into v_status
  from public.settlements
  where id = p_settlement_id
    and user_id = v_user_id;

  if v_status is null then
    raise exception using
      errcode = 'P0002',
      message = 'Settlement was not found.';
  end if;

  if v_status not in ('draft', 'reopened') then
    raise exception using
      errcode = '23514',
      message =
        'Recurring fixed costs can only be linked while the settlement is draft or reopened.';
  end if;

  if p_links is null
    or jsonb_typeof(p_links) <> 'array'
    or jsonb_array_length(p_links) = 0
  then
    raise exception using
      errcode = '23514',
      message =
        'Select at least one recurring fixed cost.';
  end if;

  perform set_config(
    'axleledger.settlement_internal_write',
    'on',
    true
  );

  perform set_config(
    'axleledger.settlement_fixed_cost_link_write',
    'on',
    true
  );

  for v_link in
    select value
    from jsonb_array_elements(p_links)
  loop
    v_fixed_cost_id :=
      nullif(
        trim(
          coalesce(
            v_link ->> 'fixed_cost_id',
            ''
          )
        ),
        ''
      )::uuid;

    v_statement_amount :=
      round(
        (
          v_link ->>
            'statement_amount'
        )::numeric,
        2
      );

    v_variance_reason :=
      nullif(
        trim(
          coalesce(
            v_link ->>
              'variance_reason',
            ''
          )
        ),
        ''
      );

    select *
    into v_fixed_cost
    from public.fixed_costs
    where id = v_fixed_cost_id
      and user_id = v_user_id;

    if not found then
      raise exception using
        errcode = '23514',
        message =
          'Select a valid recurring fixed cost.';
    end if;

    if exists (
      select 1
      from public.settlement_line_items
      where settlement_id = p_settlement_id
        and fixed_cost_id = v_fixed_cost_id
    ) then
      raise exception using
        errcode = '23505',
        message =
          'That fixed cost is already linked to this settlement.';
    end if;

    v_source_amount :=
      public.calculate_settlement_fixed_cost_source_amount(
        v_fixed_cost_id,
        p_settlement_id,
        v_user_id
      );

    if v_statement_amount is null
      or v_statement_amount <= 0
    then
      raise exception using
        errcode = '23514',
        message =
          'Statement deductions must be greater than zero.';
    end if;

    if v_statement_amount
        <> v_source_amount
      and v_variance_reason is null
    then
      raise exception using
        errcode = '23514',
        message =
          'A variance reason is required when the statement deduction differs from the expected fixed cost.';
    end if;

    v_description :=
      trim(v_fixed_cost.name)
      || ' · '
      || initcap(v_fixed_cost.frequency)
      || ' schedule';

    insert into public.settlement_line_items (
      user_id,
      settlement_id,
      fixed_cost_id,
      source_type,
      source_amount,
      variance_reason,
      kind,
      category,
      description,
      amount
    )
    values (
      v_user_id,
      p_settlement_id,
      v_fixed_cost.id,
      'fixed_cost',
      v_source_amount,
      v_variance_reason,
      'deduction',
      v_fixed_cost.category,
      v_description,
      v_statement_amount
    );

    v_linked_count :=
      v_linked_count + 1;

    v_linked_fixed_cost_ids :=
      v_linked_fixed_cost_ids
      || jsonb_build_array(
        v_fixed_cost.id
      );
  end loop;

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
    p_settlement_id,
    'fixed_costs_linked',
    v_status,
    v_status,
    jsonb_build_object(
      'count',
      v_linked_count,
      'fixed_cost_ids',
      v_linked_fixed_cost_ids
    )
  );

  return v_linked_count;
end;
$$;

create or replace function
  public.unlink_settlement_fixed_cost(
    p_settlement_id uuid,
    p_line_item_id uuid
  )
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_fixed_cost_id uuid;
  v_description text;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  select status
  into v_status
  from public.settlements
  where id = p_settlement_id
    and user_id = v_user_id;

  if v_status is null then
    raise exception using
      errcode = 'P0002',
      message = 'Settlement was not found.';
  end if;

  if v_status not in ('draft', 'reopened') then
    raise exception using
      errcode = '23514',
      message =
        'Recurring fixed costs can only be unlinked while the settlement is draft or reopened.';
  end if;

  select
    fixed_cost_id,
    description
  into
    v_fixed_cost_id,
    v_description
  from public.settlement_line_items
  where id = p_line_item_id
    and settlement_id = p_settlement_id
    and user_id = v_user_id
    and fixed_cost_id is not null;

  if v_fixed_cost_id is null then
    raise exception using
      errcode = 'P0002',
      message =
        'Linked recurring fixed cost was not found.';
  end if;

  perform set_config(
    'axleledger.settlement_internal_write',
    'on',
    true
  );

  perform set_config(
    'axleledger.settlement_fixed_cost_link_write',
    'on',
    true
  );

  delete from public.settlement_line_items
  where id = p_line_item_id
    and settlement_id = p_settlement_id
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
    p_settlement_id,
    'fixed_cost_unlinked',
    v_status,
    v_status,
    jsonb_build_object(
      'fixed_cost_id',
      v_fixed_cost_id,
      'description',
      v_description
    )
  );
end;
$$;

revoke all on function
  public.link_settlement_fixed_costs(
    uuid,
    jsonb
  )
from public, anon;

grant execute on function
  public.link_settlement_fixed_costs(
    uuid,
    jsonb
  )
to authenticated;

revoke all on function
  public.unlink_settlement_fixed_cost(
    uuid,
    uuid
  )
from public, anon;

grant execute on function
  public.unlink_settlement_fixed_cost(
    uuid,
    uuid
  )
to authenticated;

commit;
