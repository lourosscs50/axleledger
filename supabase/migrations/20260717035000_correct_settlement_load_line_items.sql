begin;

-- Settlement load relationships are now owned by line items. The legacy
-- settlement_loads table remains readable for historical compatibility, but
-- new links are not written separately from settlement_line_items.
revoke insert, delete
on table public.settlement_loads
from authenticated;

create or replace function
  public.validate_settlement_load_revenue_line()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'earning'
    and new.category = 'load_revenue'
  then
    if new.load_id is null then
      raise exception using
        errcode = '23514',
        message =
          'Load revenue requires a selected load.';
    end if;

    if exists (
      select 1
      from public.settlement_line_items
      where settlement_id = new.settlement_id
        and user_id = new.user_id
        and load_id = new.load_id
        and kind = 'earning'
        and category = 'load_revenue'
        and id <> new.id
    ) then
      raise exception using
        errcode = '23505',
        message =
          'This load already has a primary load-revenue line on the settlement.';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function
  public.validate_settlement_load_revenue_line()
from public, anon, authenticated;

drop trigger if exists
  settlement_line_items_validate_load_revenue
on public.settlement_line_items;

create trigger
  settlement_line_items_validate_load_revenue
before insert or update
on public.settlement_line_items
for each row
execute function
  public.validate_settlement_load_revenue_line();

-- Deletion is an explicit user action protected by RLS and a destructive UI
-- confirmation. Any lifecycle state may be deleted, and child records cascade.
create or replace function
  public.protect_settlement_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or coalesce(
      current_setting(
        'axleledger.settlement_internal_write',
        true
      ),
      'off'
    ) = 'on'
  then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if old.status not in ('draft', 'reopened') then
    raise exception using
      errcode = '23514',
      message =
        'Approved and in-review settlements must use lifecycle actions.';
  end if;

  if new.status is distinct from old.status
    or new.gross_pay is distinct from old.gross_pay
    or new.deductions is distinct from old.deductions
    or new.reimbursements is distinct from old.reimbursements
    or new.net_deposit is distinct from old.net_deposit
    or new.review_submitted_at is distinct from old.review_submitted_at
    or new.approved_at is distinct from old.approved_at
    or new.paid_at is distinct from old.paid_at
    or new.reopened_at is distinct from old.reopened_at
    or new.approval_version is distinct from old.approval_version
    or new.user_id is distinct from old.user_id
  then
    raise exception using
      errcode = '23514',
      message =
        'Settlement status and calculated totals cannot be changed directly.';
  end if;

  return new;
end;
$$;

revoke execute on function
  public.protect_settlement_mutation()
from public, anon, authenticated;

-- Approval snapshots derive load reconciliation from line_items.load_id.
create or replace function
  public.approve_settlement(
    p_settlement_id uuid
  )
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_version integer;
  v_snapshot jsonb;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  select status, approval_version + 1
  into v_status, v_version
  from public.settlements
  where id = p_settlement_id
    and user_id = v_user_id;

  if v_status is null then
    raise exception using
      errcode = 'P0002',
      message = 'Settlement was not found.';
  end if;

  if v_status <> 'review_needed' then
    raise exception using
      errcode = '23514',
      message =
        'Only settlements awaiting review can be approved.';
  end if;

  perform public.recalculate_settlement_totals(
    p_settlement_id,
    v_user_id
  );

  select jsonb_build_object(
    'settlement',
      to_jsonb(settlement_row)
      || jsonb_build_object(
        'status', 'approved',
        'approval_version', v_version
      ),
    'line_items', coalesce(
      (
        select jsonb_agg(
          to_jsonb(line_item)
          order by line_item.created_at,
            line_item.id
        )
        from public.settlement_line_items
          as line_item
        where line_item.settlement_id =
            p_settlement_id
          and line_item.user_id = v_user_id
      ),
      '[]'::jsonb
    ),
    'load_ids', coalesce(
      (
        select jsonb_agg(load_id order by load_id)
        from (
          select distinct line_item.load_id
          from public.settlement_line_items
            as line_item
          where line_item.settlement_id =
              p_settlement_id
            and line_item.user_id = v_user_id
            and line_item.load_id is not null
        ) as settlement_load_ids
      ),
      '[]'::jsonb
    ),
    'adjustments', coalesce(
      (
        select jsonb_agg(
          to_jsonb(adjustment)
          order by adjustment.created_at,
            adjustment.id
        )
        from public.settlement_adjustments
          as adjustment
        where adjustment.settlement_id =
            p_settlement_id
          and adjustment.user_id = v_user_id
      ),
      '[]'::jsonb
    )
  )
  into v_snapshot
  from public.settlements as settlement_row
  where settlement_row.id = p_settlement_id
    and settlement_row.user_id = v_user_id;

  perform set_config(
    'axleledger.settlement_internal_write',
    'on',
    true
  );

  update public.settlements
  set
    status = 'approved',
    approval_version = v_version,
    approved_at = now(),
    paid_at = null,
    updated_at = now()
  where id = p_settlement_id
    and user_id = v_user_id;

  insert into public.settlement_approval_snapshots (
    user_id,
    settlement_id,
    approval_version,
    snapshot
  )
  values (
    v_user_id,
    p_settlement_id,
    v_version,
    v_snapshot
  );

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
    'approved',
    v_status,
    'approved',
    jsonb_build_object(
      'approval_version',
      v_version
    )
  );
end;
$$;

revoke all on function
  public.approve_settlement(uuid)
from public, anon;

grant execute on function
  public.approve_settlement(uuid)
to authenticated;

commit;
