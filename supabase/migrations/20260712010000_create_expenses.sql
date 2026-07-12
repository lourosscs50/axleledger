begin;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references auth.users(id)
    on delete cascade,

  load_id uuid
    references public.loads(id)
    on delete set null,

  category text not null
    check (
      category in (
        'fuel',
        'maintenance',
        'tolls',
        'parking',
        'scales',
        'food',
        'supplies',
        'other'
      )
    ),

  amount numeric(12, 2) not null
    check (amount > 0),

  expense_date date not null
    default current_date,

  vendor text,

  notes text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint expenses_vendor_not_blank
    check (
      vendor is null
      or length(trim(vendor)) > 0
    ),

  constraint expenses_notes_not_blank
    check (
      notes is null
      or length(trim(notes)) > 0
    )
);

create index if not exists
  expenses_user_id_idx
on public.expenses (user_id);

create index if not exists
  expenses_user_expense_date_idx
on public.expenses (
  user_id,
  expense_date desc
);

create index if not exists
  expenses_user_category_idx
on public.expenses (
  user_id,
  category
);

create index if not exists
  expenses_user_load_id_idx
on public.expenses (
  user_id,
  load_id
)
where load_id is not null;

create or replace function
  public.validate_expense_load_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.load_id is not null
    and not exists (
      select 1
      from public.loads
      where id = new.load_id
        and user_id = new.user_id
    )
  then
    raise exception using
      errcode = '23514',
      message =
        'The selected load does not belong to this user.';
  end if;

  return new;
end;
$$;

revoke execute on function
  public.validate_expense_load_ownership()
from public, anon, authenticated;

drop trigger if exists
  expenses_validate_load_ownership
on public.expenses;

create trigger
  expenses_validate_load_ownership
before insert or update of user_id, load_id
on public.expenses
for each row
execute function
  public.validate_expense_load_ownership();

drop trigger if exists
  expenses_set_updated_at
on public.expenses;

create trigger
  expenses_set_updated_at
before update
on public.expenses
for each row
execute function public.set_updated_at();

alter table public.expenses
enable row level security;

revoke all
on table public.expenses
from anon;

grant select, insert, update, delete
on table public.expenses
to authenticated;

drop policy if exists
  "expenses_select_own"
on public.expenses;

create policy
  "expenses_select_own"
on public.expenses
for select
to authenticated
using (
  (select auth.uid()) = user_id
);

drop policy if exists
  "expenses_insert_own"
on public.expenses;

create policy
  "expenses_insert_own"
on public.expenses
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
);

drop policy if exists
  "expenses_update_own"
on public.expenses;

create policy
  "expenses_update_own"
on public.expenses
for update
to authenticated
using (
  (select auth.uid()) = user_id
)
with check (
  (select auth.uid()) = user_id
);

drop policy if exists
  "expenses_delete_own"
on public.expenses;

create policy
  "expenses_delete_own"
on public.expenses
for delete
to authenticated
using (
  (select auth.uid()) = user_id
);

commit;
