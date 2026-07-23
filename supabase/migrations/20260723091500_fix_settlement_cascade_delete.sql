begin;

-- Skip total recalculation while a whole settlement and its children
-- are being removed through the controlled deletion function.
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

  if coalesce(
    current_setting(
      'axleledger.settlement_delete',
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

  if not exists (
    select 1
    from public.settlements
    where id = v_settlement_id
      and user_id = v_user_id
  ) then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
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
  public.delete_settlement(
    p_settlement_id uuid
  )
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.settlements
    where id = p_settlement_id
      and user_id = v_user_id
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'Settlement was not found.';
  end if;

  perform set_config(
    'axleledger.settlement_internal_write',
    'on',
    true
  );

  perform set_config(
    'axleledger.settlement_delete',
    'on',
    true
  );

  delete from public.settlements
  where id = p_settlement_id
    and user_id = v_user_id;
end;
$$;

revoke all on function
  public.delete_settlement(uuid)
from public, anon;

grant execute on function
  public.delete_settlement(uuid)
to authenticated;

-- Settlement deletion must go through the controlled RPC.
revoke delete
on table public.settlements
from authenticated;

commit;
