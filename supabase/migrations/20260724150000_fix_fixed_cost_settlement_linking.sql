begin;

-- Carrier statements can legitimately close below zero when deductions exceed
-- earnings. Preserve the signed balance instead of rejecting valid fixed-cost
-- links such as truck and trailer payments.
alter table public.settlements
  drop constraint if exists
    settlements_net_deposit_check;

create or replace function
  public.recalculate_settlement_totals(
    p_settlement_id uuid,
    p_user_id uuid
  )
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gross numeric(12, 2);
  v_deductions numeric(12, 2);
  v_reimbursements numeric(12, 2);
  v_adjustments numeric(12, 2);
  v_net numeric(12, 2);
begin
  if not exists (
    select 1
    from public.settlements
    where id = p_settlement_id
      and user_id = p_user_id
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'Settlement was not found.';
  end if;

  select
    coalesce(
      sum(amount) filter (
        where kind = 'earning'
      ),
      0
    ),
    coalesce(
      sum(amount) filter (
        where kind = 'deduction'
      ),
      0
    ),
    coalesce(
      sum(amount) filter (
        where kind = 'reimbursement'
      ),
      0
    )
  into
    v_gross,
    v_deductions,
    v_reimbursements
  from public.settlement_line_items
  where settlement_id = p_settlement_id
    and user_id = p_user_id;

  select coalesce(sum(amount), 0)
  into v_adjustments
  from public.settlement_adjustments
  where settlement_id = p_settlement_id
    and user_id = p_user_id;

  v_net := round(
    v_gross
    + v_reimbursements
    - v_deductions
    + v_adjustments,
    2
  );

  perform set_config(
    'axleledger.settlement_internal_write',
    'on',
    true
  );

  update public.settlements
  set
    gross_pay = round(v_gross, 2),
    deductions = round(v_deductions, 2),
    reimbursements = round(v_reimbursements, 2),
    net_deposit = v_net,
    updated_at = now()
  where id = p_settlement_id
    and user_id = p_user_id;
end;
$$;

revoke execute on function
  public.recalculate_settlement_totals(uuid, uuid)
from public, anon, authenticated;

comment on column public.settlements.net_deposit is
  'Signed net settlement amount. Positive values are deposits; negative values are carrier balances or amounts carried forward.';

-- A fixed cost is authoritative at its saved amount. Settlement dates and
-- periods do not prorate or otherwise calculate a separate expected amount.
-- The existing signature remains for compatibility with prior migrations.
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
begin
  if not exists (
    select 1
    from public.settlements
    where id = p_settlement_id
      and user_id = p_user_id
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'Settlement was not found.';
  end if;

  select round(amount, 2)
  into v_amount
  from public.fixed_costs
  where id = p_fixed_cost_id
    and user_id = p_user_id;

  if v_amount is null then
    raise exception using
      errcode = 'P0002',
      message = 'Fixed cost was not found.';
  end if;

  if v_amount <= 0 then
    raise exception using
      errcode = '23514',
      message =
        'The fixed-cost amount must be greater than zero.';
  end if;

  return v_amount;
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
  v_fixed_amount numeric(12, 2);
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

    v_fixed_amount := round(v_fixed_cost.amount, 2);

    if v_fixed_amount <= 0 then
      raise exception using
        errcode = '23514',
        message =
          'The fixed-cost amount must be greater than zero.';
    end if;

    v_description :=
      trim(v_fixed_cost.name)
      || ' · '
      || initcap(v_fixed_cost.frequency)
      || ' fixed cost';

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
      v_fixed_amount,
      null,
      'deduction',
      v_fixed_cost.category,
      v_description,
      v_fixed_amount
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
      v_linked_fixed_cost_ids,
      'amount_rule',
      'exact_saved_fixed_cost_amount'
    )
  );

  return v_linked_count;
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

-- Editing a fixed cost updates only editable settlement links. Approved and
-- paid records remain historical snapshots of what the carrier statement used.
create or replace function
  public.sync_editable_settlement_fixed_cost_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name is not distinct from old.name
    and new.category is not distinct from old.category
    and new.amount is not distinct from old.amount
    and new.frequency is not distinct from old.frequency
  then
    return new;
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

  update public.settlement_line_items as line_item
  set
    source_amount = round(new.amount, 2),
    amount = round(new.amount, 2),
    variance_reason = null,
    category = new.category,
    description =
      trim(new.name)
      || ' · '
      || initcap(new.frequency)
      || ' fixed cost',
    updated_at = now()
  from public.settlements as settlement
  where line_item.fixed_cost_id = new.id
    and line_item.user_id = new.user_id
    and settlement.id = line_item.settlement_id
    and settlement.user_id = line_item.user_id
    and settlement.status in ('draft', 'reopened');

  return new;
end;
$$;

revoke execute on function
  public.sync_editable_settlement_fixed_cost_links()
from public, anon, authenticated;

drop trigger if exists
  fixed_costs_sync_editable_settlement_links
on public.fixed_costs;

create trigger
  fixed_costs_sync_editable_settlement_links
after update of name, category, amount, frequency
on public.fixed_costs
for each row
execute function
  public.sync_editable_settlement_fixed_cost_links();

-- Normalize only editable statements. Approved and paid settlement lines remain
-- historical snapshots; editing a fixed-cost record affects future links.
select set_config(
  'axleledger.settlement_internal_write',
  'on',
  true
);

select set_config(
  'axleledger.settlement_fixed_cost_link_write',
  'on',
  true
);

update public.settlement_line_items as line_item
set
  source_amount = round(fixed_cost.amount, 2),
  amount = round(fixed_cost.amount, 2),
  variance_reason = null,
  updated_at = now()
from public.fixed_costs as fixed_cost,
  public.settlements as settlement
where line_item.fixed_cost_id = fixed_cost.id
  and line_item.user_id = fixed_cost.user_id
  and settlement.id = line_item.settlement_id
  and settlement.user_id = line_item.user_id
  and settlement.status in ('draft', 'reopened');

commit;
