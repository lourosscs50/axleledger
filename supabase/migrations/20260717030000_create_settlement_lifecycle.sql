begin;

create temporary table axleledger_v1_settlements
on commit drop
as
select
  id,
  user_id,
  gross_pay,
  deductions,
  reimbursements,
  net_deposit,
  created_at,
  updated_at
from public.settlements;

alter table public.settlements
  add column if not exists statement_number text,
  add column if not exists period_start_date date,
  add column if not exists period_end_date date,
  add column if not exists status text not null default 'draft',
  add column if not exists review_submitted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists reopened_at timestamptz,
  add column if not exists approval_version integer not null default 0;

alter table public.settlements
  drop constraint if exists settlements_status_check;

alter table public.settlements
  add constraint settlements_status_check
  check (
    status in (
      'draft',
      'review_needed',
      'approved',
      'paid',
      'reopened'
    )
  );

alter table public.settlements
  drop constraint if exists settlements_period_dates_valid;

alter table public.settlements
  add constraint settlements_period_dates_valid
  check (
    period_start_date is null
    or period_end_date is null
    or period_end_date >= period_start_date
  );

alter table public.settlements
  drop constraint if exists settlements_statement_number_not_blank;

alter table public.settlements
  add constraint settlements_statement_number_not_blank
  check (
    statement_number is null
    or length(trim(statement_number)) > 0
  );

alter table public.settlements
  drop constraint if exists settlements_approval_version_valid;

alter table public.settlements
  add constraint settlements_approval_version_valid
  check (approval_version >= 0);

create index if not exists
  settlements_user_status_date_idx
on public.settlements (
  user_id,
  status,
  settlement_date desc
);

create table if not exists public.settlement_line_items (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references auth.users(id)
    on delete cascade,

  settlement_id uuid not null
    references public.settlements(id)
    on delete cascade,

  load_id uuid
    references public.loads(id)
    on delete set null,

  kind text not null
    check (
      kind in (
        'earning',
        'deduction',
        'reimbursement'
      )
    ),

  category text not null
    check (length(trim(category)) > 0),

  description text not null
    check (length(trim(description)) > 0),

  amount numeric(12, 2) not null
    check (amount > 0),

  authorization_reference text,
  balance_after numeric(12, 2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint settlement_line_items_authorization_not_blank
    check (
      authorization_reference is null
      or length(trim(authorization_reference)) > 0
    ),

  constraint settlement_line_items_balance_valid
    check (
      balance_after is null
      or balance_after >= 0
    ),

  constraint settlement_line_items_deduction_fields
    check (
      kind = 'deduction'
      or (
        authorization_reference is null
        and balance_after is null
      )
    )
);

create index if not exists
  settlement_line_items_settlement_idx
on public.settlement_line_items (
  user_id,
  settlement_id,
  created_at
);

create index if not exists
  settlement_line_items_load_idx
on public.settlement_line_items (
  user_id,
  load_id
)
where load_id is not null;

create table if not exists public.settlement_loads (
  user_id uuid not null
    default auth.uid()
    references auth.users(id)
    on delete cascade,

  settlement_id uuid not null
    references public.settlements(id)
    on delete cascade,

  load_id uuid not null
    references public.loads(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  primary key (settlement_id, load_id)
);

create index if not exists
  settlement_loads_user_load_idx
on public.settlement_loads (
  user_id,
  load_id
);

create table if not exists public.settlement_adjustments (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references auth.users(id)
    on delete cascade,

  settlement_id uuid not null
    references public.settlements(id)
    on delete cascade,

  amount numeric(12, 2) not null
    check (amount <> 0),

  reason text not null
    check (length(trim(reason)) > 0),

  created_at timestamptz not null default now()
);

create index if not exists
  settlement_adjustments_settlement_idx
on public.settlement_adjustments (
  user_id,
  settlement_id,
  created_at
);

create table if not exists public.settlement_approval_snapshots (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references auth.users(id)
    on delete cascade,

  settlement_id uuid not null
    references public.settlements(id)
    on delete cascade,

  approval_version integer not null
    check (approval_version > 0),

  snapshot jsonb not null,

  created_at timestamptz not null default now(),

  unique (settlement_id, approval_version)
);

create index if not exists
  settlement_approval_snapshots_settlement_idx
on public.settlement_approval_snapshots (
  user_id,
  settlement_id,
  approval_version desc
);

create table if not exists public.settlement_audit_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references auth.users(id)
    on delete cascade,

  settlement_id uuid not null
    references public.settlements(id)
    on delete cascade,

  event_type text not null
    check (length(trim(event_type)) > 0),

  from_status text,
  to_status text,
  details jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists
  settlement_audit_events_settlement_idx
on public.settlement_audit_events (
  user_id,
  settlement_id,
  created_at desc
);

insert into public.settlement_line_items (
  user_id,
  settlement_id,
  kind,
  category,
  description,
  amount
)
select
  legacy.user_id,
  legacy.id,
  'earning',
  'legacy_gross_pay',
  'Imported gross pay',
  legacy.gross_pay
from axleledger_v1_settlements as legacy
where legacy.gross_pay > 0
  and not exists (
    select 1
    from public.settlement_line_items
    where settlement_id = legacy.id
      and category = 'legacy_gross_pay'
  );

insert into public.settlement_line_items (
  user_id,
  settlement_id,
  kind,
  category,
  description,
  amount
)
select
  legacy.user_id,
  legacy.id,
  'deduction',
  'legacy_deductions',
  'Imported deductions',
  legacy.deductions
from axleledger_v1_settlements as legacy
where legacy.deductions > 0
  and not exists (
    select 1
    from public.settlement_line_items
    where settlement_id = legacy.id
      and category = 'legacy_deductions'
  );

insert into public.settlement_line_items (
  user_id,
  settlement_id,
  kind,
  category,
  description,
  amount
)
select
  legacy.user_id,
  legacy.id,
  'reimbursement',
  'legacy_reimbursements',
  'Imported reimbursements',
  legacy.reimbursements
from axleledger_v1_settlements as legacy
where legacy.reimbursements > 0
  and not exists (
    select 1
    from public.settlement_line_items
    where settlement_id = legacy.id
      and category = 'legacy_reimbursements'
  );

insert into public.settlement_adjustments (
  user_id,
  settlement_id,
  amount,
  reason
)
select
  legacy.user_id,
  legacy.id,
  round(
    legacy.net_deposit
    - (
      legacy.gross_pay
      + legacy.reimbursements
      - legacy.deductions
    ),
    2
  ),
  'Imported V1 net-deposit reconciliation'
from axleledger_v1_settlements as legacy
where round(
  legacy.net_deposit
  - (
    legacy.gross_pay
    + legacy.reimbursements
    - legacy.deductions
  ),
  2
) <> 0
and not exists (
  select 1
  from public.settlement_adjustments
  where settlement_id = legacy.id
    and reason = 'Imported V1 net-deposit reconciliation'
);

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

  if v_net < 0 then
    raise exception using
      errcode = '23514',
      message =
        'Settlement totals cannot produce a negative net deposit.';
  end if;

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

create or replace function
  public.refresh_settlement_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settlement_id uuid;
  v_user_id uuid;
begin
  if tg_op = 'DELETE' then
    v_settlement_id := old.settlement_id;
    v_user_id := old.user_id;
  else
    v_settlement_id := new.settlement_id;
    v_user_id := new.user_id;
  end if;

  perform public.recalculate_settlement_totals(
    v_settlement_id,
    v_user_id
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke execute on function
  public.refresh_settlement_totals()
from public, anon, authenticated;

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
    if old.status not in ('draft', 'reopened') then
      raise exception using
        errcode = '23514',
        message =
          'Only draft or reopened settlements can be deleted.';
    end if;

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
  v_status text;
begin
  if tg_op = 'DELETE' then
    v_settlement_id := old.settlement_id;
    v_user_id := old.user_id;
    v_load_id := old.load_id;
  else
    v_settlement_id := new.settlement_id;
    v_user_id := new.user_id;
    v_load_id := new.load_id;
  end if;

  if auth.uid() is not null
    and coalesce(
      current_setting(
        'axleledger.settlement_internal_write',
        true
      ),
      'off'
    ) <> 'on'
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
  public.submit_settlement_for_review(
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
        'Only draft or reopened settlements can be submitted.';
  end if;

  if not exists (
    select 1
    from public.settlement_line_items
    where settlement_id = p_settlement_id
      and user_id = v_user_id
      and kind = 'earning'
  ) then
    raise exception using
      errcode = '23514',
      message =
        'Add at least one earning before submitting for review.';
  end if;

  perform public.recalculate_settlement_totals(
    p_settlement_id,
    v_user_id
  );

  perform set_config(
    'axleledger.settlement_internal_write',
    'on',
    true
  );

  update public.settlements
  set
    status = 'review_needed',
    review_submitted_at = now(),
    reopened_at = null,
    updated_at = now()
  where id = p_settlement_id
    and user_id = v_user_id;

  insert into public.settlement_audit_events (
    user_id,
    settlement_id,
    event_type,
    from_status,
    to_status
  )
  values (
    v_user_id,
    p_settlement_id,
    'submitted_for_review',
    v_status,
    'review_needed'
  );
end;
$$;

create or replace function
  public.return_settlement_to_draft(
    p_settlement_id uuid,
    p_reason text
  )
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  if v_reason is null then
    raise exception using
      errcode = '23514',
      message = 'A return reason is required.';
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

  if v_status <> 'review_needed' then
    raise exception using
      errcode = '23514',
      message =
        'Only settlements awaiting review can return to draft.';
  end if;

  perform set_config(
    'axleledger.settlement_internal_write',
    'on',
    true
  );

  update public.settlements
  set
    status = 'draft',
    review_submitted_at = null,
    updated_at = now()
  where id = p_settlement_id
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
    'returned_to_draft',
    v_status,
    'draft',
    jsonb_build_object('reason', v_reason)
  );
end;
$$;

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
          order by line_item.created_at, line_item.id
        )
        from public.settlement_line_items as line_item
        where line_item.settlement_id = p_settlement_id
          and line_item.user_id = v_user_id
      ),
      '[]'::jsonb
    ),
    'linked_loads', coalesce(
      (
        select jsonb_agg(
          to_jsonb(linked_load)
          order by linked_load.created_at, linked_load.load_id
        )
        from public.settlement_loads as linked_load
        where linked_load.settlement_id = p_settlement_id
          and linked_load.user_id = v_user_id
      ),
      '[]'::jsonb
    ),
    'adjustments', coalesce(
      (
        select jsonb_agg(
          to_jsonb(adjustment)
          order by adjustment.created_at, adjustment.id
        )
        from public.settlement_adjustments as adjustment
        where adjustment.settlement_id = p_settlement_id
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

create or replace function
  public.mark_settlement_paid(
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

  if v_status <> 'approved' then
    raise exception using
      errcode = '23514',
      message = 'Only approved settlements can be marked paid.';
  end if;

  perform set_config(
    'axleledger.settlement_internal_write',
    'on',
    true
  );

  update public.settlements
  set
    status = 'paid',
    paid_at = now(),
    updated_at = now()
  where id = p_settlement_id
    and user_id = v_user_id;

  insert into public.settlement_audit_events (
    user_id,
    settlement_id,
    event_type,
    from_status,
    to_status
  )
  values (
    v_user_id,
    p_settlement_id,
    'marked_paid',
    v_status,
    'paid'
  );
end;
$$;

create or replace function
  public.reopen_settlement(
    p_settlement_id uuid,
    p_reason text
  )
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  if v_reason is null then
    raise exception using
      errcode = '23514',
      message = 'A reopen reason is required.';
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

  if v_status not in ('approved', 'paid') then
    raise exception using
      errcode = '23514',
      message =
        'Only approved or paid settlements can be reopened.';
  end if;

  perform set_config(
    'axleledger.settlement_internal_write',
    'on',
    true
  );

  update public.settlements
  set
    status = 'reopened',
    review_submitted_at = null,
    approved_at = null,
    paid_at = null,
    reopened_at = now(),
    updated_at = now()
  where id = p_settlement_id
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
    'reopened',
    v_status,
    'reopened',
    jsonb_build_object('reason', v_reason)
  );
end;
$$;

create or replace function
  public.add_settlement_adjustment(
    p_settlement_id uuid,
    p_amount numeric,
    p_reason text
  )
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_adjustment_id uuid;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  if p_amount = 0 then
    raise exception using
      errcode = '23514',
      message = 'Adjustment amount cannot be zero.';
  end if;

  if v_reason is null then
    raise exception using
      errcode = '23514',
      message = 'An adjustment reason is required.';
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

  if v_status not in ('approved', 'paid') then
    raise exception using
      errcode = '23514',
      message =
        'Adjustments are only allowed after approval.';
  end if;

  perform set_config(
    'axleledger.settlement_internal_write',
    'on',
    true
  );

  insert into public.settlement_adjustments (
    user_id,
    settlement_id,
    amount,
    reason
  )
  values (
    v_user_id,
    p_settlement_id,
    round(p_amount, 2),
    v_reason
  )
  returning id into v_adjustment_id;

  perform public.recalculate_settlement_totals(
    p_settlement_id,
    v_user_id
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
    'adjustment_added',
    v_status,
    v_status,
    jsonb_build_object(
      'adjustment_id', v_adjustment_id,
      'amount', round(p_amount, 2),
      'reason', v_reason
    )
  );

  return v_adjustment_id;
end;
$$;

revoke all on function
  public.submit_settlement_for_review(uuid)
from public, anon;

grant execute on function
  public.submit_settlement_for_review(uuid)
to authenticated;

revoke all on function
  public.return_settlement_to_draft(uuid, text)
from public, anon;

grant execute on function
  public.return_settlement_to_draft(uuid, text)
to authenticated;

revoke all on function
  public.approve_settlement(uuid)
from public, anon;

grant execute on function
  public.approve_settlement(uuid)
to authenticated;

revoke all on function
  public.mark_settlement_paid(uuid)
from public, anon;

grant execute on function
  public.mark_settlement_paid(uuid)
to authenticated;

revoke all on function
  public.reopen_settlement(uuid, text)
from public, anon;

grant execute on function
  public.reopen_settlement(uuid, text)
to authenticated;

revoke all on function
  public.add_settlement_adjustment(uuid, numeric, text)
from public, anon;

grant execute on function
  public.add_settlement_adjustment(uuid, numeric, text)
to authenticated;

drop trigger if exists
  settlements_protect_mutation
on public.settlements;

create trigger
  settlements_protect_mutation
before update or delete
on public.settlements
for each row
execute function
  public.protect_settlement_mutation();

drop trigger if exists
  settlements_set_updated_at
on public.settlements;

create trigger
  settlements_set_updated_at
before update
on public.settlements
for each row
execute function public.set_updated_at();

drop trigger if exists
  settlement_line_items_validate_mutation
on public.settlement_line_items;

create trigger
  settlement_line_items_validate_mutation
before insert or update or delete
on public.settlement_line_items
for each row
execute function
  public.validate_settlement_child_mutation();

drop trigger if exists
  settlement_loads_validate_mutation
on public.settlement_loads;

create trigger
  settlement_loads_validate_mutation
before insert or update or delete
on public.settlement_loads
for each row
execute function
  public.validate_settlement_child_mutation();

drop trigger if exists
  settlement_line_items_refresh_totals
on public.settlement_line_items;

create trigger
  settlement_line_items_refresh_totals
after insert or update or delete
on public.settlement_line_items
for each row
execute function
  public.refresh_settlement_totals();

drop trigger if exists
  settlement_adjustments_refresh_totals
on public.settlement_adjustments;

create trigger
  settlement_adjustments_refresh_totals
after insert or update or delete
on public.settlement_adjustments
for each row
execute function
  public.refresh_settlement_totals();

drop trigger if exists
  settlement_line_items_set_updated_at
on public.settlement_line_items;

create trigger
  settlement_line_items_set_updated_at
before update
on public.settlement_line_items
for each row
execute function public.set_updated_at();

update public.settlements
set
  status = 'paid',
  approval_version = greatest(approval_version, 1),
  review_submitted_at = coalesce(review_submitted_at, created_at),
  approved_at = coalesce(approved_at, created_at),
  paid_at = coalesce(paid_at, created_at)
where id in (
  select id
  from axleledger_v1_settlements
);

do $$
declare
  settlement_record record;
begin
  for settlement_record in
    select id, user_id
    from public.settlements
  loop
    perform public.recalculate_settlement_totals(
      settlement_record.id,
      settlement_record.user_id
    );
  end loop;
end;
$$;

insert into public.settlement_approval_snapshots (
  user_id,
  settlement_id,
  approval_version,
  snapshot,
  created_at
)
select
  settlements.user_id,
  settlements.id,
  settlements.approval_version,
  jsonb_build_object(
    'legacy_import', true,
    'settlement', to_jsonb(settlements),
    'line_items', coalesce(
      (
        select jsonb_agg(
          to_jsonb(line_item)
          order by line_item.created_at, line_item.id
        )
        from public.settlement_line_items as line_item
        where line_item.settlement_id = settlements.id
      ),
      '[]'::jsonb
    ),
    'adjustments', coalesce(
      (
        select jsonb_agg(
          to_jsonb(adjustment)
          order by adjustment.created_at, adjustment.id
        )
        from public.settlement_adjustments as adjustment
        where adjustment.settlement_id = settlements.id
      ),
      '[]'::jsonb
    )
  ),
  coalesce(settlements.approved_at, settlements.created_at)
from public.settlements
where settlements.id in (
  select id
  from axleledger_v1_settlements
)
  and settlements.status = 'paid'
  and settlements.approval_version > 0
on conflict (settlement_id, approval_version)
do nothing;

insert into public.settlement_audit_events (
  user_id,
  settlement_id,
  event_type,
  from_status,
  to_status,
  details,
  created_at
)
select
  settlements.user_id,
  settlements.id,
  'legacy_imported',
  null,
  'paid',
  jsonb_build_object(
    'source', 'AxleLedger V1'
  ),
  settlements.created_at
from public.settlements
where settlements.id in (
  select id
  from axleledger_v1_settlements
)
  and settlements.status = 'paid'
  and not exists (
    select 1
    from public.settlement_audit_events
    where settlement_id = settlements.id
      and event_type = 'legacy_imported'
  );

alter table public.settlement_line_items
  enable row level security;

alter table public.settlement_loads
  enable row level security;

alter table public.settlement_adjustments
  enable row level security;

alter table public.settlement_approval_snapshots
  enable row level security;

alter table public.settlement_audit_events
  enable row level security;

revoke all on table public.settlement_line_items
from anon;

revoke all on table public.settlement_loads
from anon;

revoke all on table public.settlement_adjustments
from anon;

revoke all on table public.settlement_approval_snapshots
from anon;

revoke all on table public.settlement_audit_events
from anon;

grant select, insert, delete
on table public.settlement_line_items
to authenticated;

grant select, insert, delete
on table public.settlement_loads
to authenticated;

grant select
on table public.settlement_adjustments
to authenticated;

grant select
on table public.settlement_approval_snapshots
to authenticated;

grant select
on table public.settlement_audit_events
to authenticated;

drop policy if exists
  "settlement_line_items_select_own"
on public.settlement_line_items;

create policy
  "settlement_line_items_select_own"
on public.settlement_line_items
for select
to authenticated
using (
  (select auth.uid()) = user_id
);

drop policy if exists
  "settlement_line_items_insert_own"
on public.settlement_line_items;

create policy
  "settlement_line_items_insert_own"
on public.settlement_line_items
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
);

drop policy if exists
  "settlement_line_items_delete_own"
on public.settlement_line_items;

create policy
  "settlement_line_items_delete_own"
on public.settlement_line_items
for delete
to authenticated
using (
  (select auth.uid()) = user_id
);

drop policy if exists
  "settlement_loads_select_own"
on public.settlement_loads;

create policy
  "settlement_loads_select_own"
on public.settlement_loads
for select
to authenticated
using (
  (select auth.uid()) = user_id
);

drop policy if exists
  "settlement_loads_insert_own"
on public.settlement_loads;

create policy
  "settlement_loads_insert_own"
on public.settlement_loads
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
);

drop policy if exists
  "settlement_loads_delete_own"
on public.settlement_loads;

create policy
  "settlement_loads_delete_own"
on public.settlement_loads
for delete
to authenticated
using (
  (select auth.uid()) = user_id
);

drop policy if exists
  "settlement_adjustments_select_own"
on public.settlement_adjustments;

create policy
  "settlement_adjustments_select_own"
on public.settlement_adjustments
for select
to authenticated
using (
  (select auth.uid()) = user_id
);

drop policy if exists
  "settlement_approval_snapshots_select_own"
on public.settlement_approval_snapshots;

create policy
  "settlement_approval_snapshots_select_own"
on public.settlement_approval_snapshots
for select
to authenticated
using (
  (select auth.uid()) = user_id
);

drop policy if exists
  "settlement_audit_events_select_own"
on public.settlement_audit_events;

create policy
  "settlement_audit_events_select_own"
on public.settlement_audit_events
for select
to authenticated
using (
  (select auth.uid()) = user_id
);

commit;
