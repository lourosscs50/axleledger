begin;

alter table public.settlement_line_items
  add column if not exists expense_id uuid
    references public.expenses(id)
    on delete restrict,
  add column if not exists source_type text,
  add column if not exists source_amount numeric(12, 2),
  add column if not exists variance_reason text;

alter table public.settlement_line_items
  drop constraint if exists
    settlement_line_items_expense_source_valid;

alter table public.settlement_line_items
  add constraint
    settlement_line_items_expense_source_valid
  check (
    (
      expense_id is null
      and source_type is null
      and source_amount is null
      and variance_reason is null
    )
    or (
      expense_id is not null
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
  );

create unique index if not exists
  settlement_line_items_expense_unique
on public.settlement_line_items (expense_id)
where expense_id is not null;

create index if not exists
  settlement_line_items_user_expense_idx
on public.settlement_line_items (
  user_id,
  expense_id
)
where expense_id is not null;

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
  v_status text;
  v_expense_amount numeric(12, 2);
  v_internal_write boolean;
  v_expense_link_write boolean;
begin
  if tg_op = 'DELETE' then
    v_settlement_id := old.settlement_id;
    v_user_id := old.user_id;
    v_load_id := old.load_id;
    v_expense_id := old.expense_id;
  else
    v_settlement_id := new.settlement_id;
    v_user_id := new.user_id;
    v_load_id := new.load_id;
    v_expense_id := new.expense_id;
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
        'axleledger.settlement_expense_link_write',
        true
      ),
      'off'
    ) <> 'on'
    and exists (
      select 1
      from public.settlement_line_items
      where expense_id = old.id
    )
  then
    raise exception using
      errcode = '23514',
      message =
        'This operating expense is linked to a settlement. Unlink it from the settlement before editing or deleting it.';
  end if;

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
  public.link_settlement_expenses(
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
  v_expense public.expenses%rowtype;
  v_expense_id uuid;
  v_statement_amount numeric(12, 2);
  v_variance_reason text;
  v_description text;
  v_linked_count integer := 0;
  v_linked_expense_ids jsonb := '[]'::jsonb;
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
        'Operating expenses can only be linked while the settlement is draft or reopened.';
  end if;

  if p_links is null
    or jsonb_typeof(p_links) <> 'array'
    or jsonb_array_length(p_links) = 0
  then
    raise exception using
      errcode = '23514',
      message =
        'Select at least one operating expense.';
  end if;

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

  for v_link in
    select value
    from jsonb_array_elements(p_links)
  loop
    v_expense_id :=
      nullif(
        trim(
          coalesce(
            v_link ->> 'expense_id',
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
    into v_expense
    from public.expenses
    where id = v_expense_id
      and user_id = v_user_id;

    if not found then
      raise exception using
        errcode = '23514',
        message =
          'Select a valid operating expense.';
    end if;

    if exists (
      select 1
      from public.settlement_line_items
      where expense_id = v_expense_id
    ) then
      raise exception using
        errcode = '23505',
        message =
          'That operating expense is already linked to a settlement.';
    end if;

    if v_statement_amount is null
      or v_statement_amount <= 0
    then
      raise exception using
        errcode = '23514',
        message =
          'Statement deductions must be greater than zero.';
    end if;

    if v_statement_amount
        <> round(v_expense.amount, 2)
      and v_variance_reason is null
    then
      raise exception using
        errcode = '23514',
        message =
          'A variance reason is required when the statement deduction differs from the expense ledger.';
    end if;

    v_description :=
      coalesce(
        nullif(
          trim(
            coalesce(
              v_expense.vendor,
              ''
            )
          ),
          ''
        ),
        initcap(
          replace(
            v_expense.category,
            '_',
            ' '
          )
        ) || ' expense'
      )
      || ' · '
      || to_char(
        v_expense.expense_date,
        'Mon DD, YYYY'
      );

    insert into public.settlement_line_items (
      user_id,
      settlement_id,
      load_id,
      expense_id,
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
      v_expense.load_id,
      v_expense.id,
      'expense',
      round(v_expense.amount, 2),
      v_variance_reason,
      'deduction',
      v_expense.category,
      v_description,
      v_statement_amount
    );

    v_linked_count :=
      v_linked_count + 1;

    v_linked_expense_ids :=
      v_linked_expense_ids
      || jsonb_build_array(
        v_expense.id
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
    'operating_expenses_linked',
    v_status,
    v_status,
    jsonb_build_object(
      'count',
      v_linked_count,
      'expense_ids',
      v_linked_expense_ids
    )
  );

  return v_linked_count;
end;
$$;

create or replace function
  public.unlink_settlement_expense(
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
  v_expense_id uuid;
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
        'Operating expenses can only be unlinked while the settlement is draft or reopened.';
  end if;

  select
    expense_id,
    description
  into
    v_expense_id,
    v_description
  from public.settlement_line_items
  where id = p_line_item_id
    and settlement_id = p_settlement_id
    and user_id = v_user_id
    and expense_id is not null;

  if v_expense_id is null then
    raise exception using
      errcode = 'P0002',
      message =
        'Linked operating expense was not found.';
  end if;

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
    'operating_expense_unlinked',
    v_status,
    v_status,
    jsonb_build_object(
      'expense_id',
      v_expense_id,
      'description',
      v_description
    )
  );
end;
$$;

revoke all on function
  public.link_settlement_expenses(
    uuid,
    jsonb
  )
from public, anon;

grant execute on function
  public.link_settlement_expenses(
    uuid,
    jsonb
  )
to authenticated;

revoke all on function
  public.unlink_settlement_expense(
    uuid,
    uuid
  )
from public, anon;

grant execute on function
  public.unlink_settlement_expense(
    uuid,
    uuid
  )
to authenticated;

commit;
