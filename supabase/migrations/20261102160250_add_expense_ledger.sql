-- Matches the schema version recorded by the connected Supabase project.
-- Additive migration: existing shifts and their access policies remain unchanged.
create schema if not exists babyguard_private;
revoke all on schema babyguard_private from public, anon;
grant usage on schema babyguard_private to authenticated;

create table babyguard_private.team_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table babyguard_private.team_members enable row level security;
revoke all on babyguard_private.team_members from public, anon, authenticated;
grant select on babyguard_private.team_members to authenticated;
create policy "Read own team membership" on babyguard_private.team_members
  for select to authenticated using (user_id = (select auth.uid()));

-- Bootstrap another environment with a session setting containing a JSON array
-- of exactly two verified team email addresses: babyguard.team_emails.
-- Account addresses and generated IDs are deliberately kept out of public source.
insert into babyguard_private.team_members (user_id)
select id from auth.users
where lower(email) in (
  select lower(value) from jsonb_array_elements_text(
    coalesce(nullif(current_setting('babyguard.team_emails', true), ''), '[]')::jsonb
  )
);
do $$
begin
  if (select count(*) from babyguard_private.team_members) <> 2 then
    raise exception 'Both existing BabyGuard team accounts must be present';
  end if;
end $$;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  category text not null check (category in ('domen_hosting', 'marketing', 'oprema', 'softver', 'administracija', 'prevoz', 'ostalo')),
  amount numeric not null check (amount > 0 and amount <= 9999999999.99 and amount = round(amount, 2)),
  payment_method text not null check (payment_method in ('kartica', 'racun', 'gotovina')),
  description text check (char_length(description) <= 500),
  created timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id)
);
create index expenses_date_created_id_idx on public.expenses (date desc, created desc, id);
create index expenses_created_by_idx on public.expenses (created_by);

alter table public.expenses enable row level security;
revoke all on public.expenses from public, anon, authenticated;
grant select, insert, delete on public.expenses to authenticated;
grant update (date, title, category, amount, payment_method, description) on public.expenses to authenticated;

create policy "Team reads expenses" on public.expenses for select to authenticated
  using ((select auth.uid()) in (select user_id from babyguard_private.team_members));
create policy "Team inserts expenses" on public.expenses for insert to authenticated
  with check ((select auth.uid()) in (select user_id from babyguard_private.team_members)
    and created_by = (select auth.uid()));
create policy "Team updates expenses" on public.expenses for update to authenticated
  using ((select auth.uid()) in (select user_id from babyguard_private.team_members))
  with check ((select auth.uid()) in (select user_id from babyguard_private.team_members));
create policy "Team deletes expenses" on public.expenses for delete to authenticated
  using ((select auth.uid()) in (select user_id from babyguard_private.team_members));

-- A PostgREST RPC is one transaction: failure restores both original ledgers.
-- NULL expenses means an older shifts-only backup; leave expenses untouched.
create function public.restore_babyguard_backup(backup_shifts jsonb, backup_expenses jsonb default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  shift_count integer;
  expense_count integer;
begin
  if not exists (select 1 from babyguard_private.team_members where user_id = (select auth.uid())) then
    raise exception 'Only BabyGuard team members can restore backups' using errcode = '42501';
  end if;
  if backup_shifts is null or jsonb_typeof(backup_shifts) <> 'array'
    or (backup_expenses is not null and jsonb_typeof(backup_expenses) <> 'array') then
    raise exception 'Backup ledgers must be arrays' using errcode = '22023';
  end if;

  -- Serialize restores with ordinary edits to avoid interleaving two replacements.
  lock table public.shifts, public.expenses in share row exclusive mode;
  if exists (
    select 1 from jsonb_to_recordset(backup_shifts) as r(date date, family text, sitter text,
      hours numeric, charged numeric, paid numeric)
    where r.date is null or coalesce(btrim(r.family), '') = '' or coalesce(btrim(r.sitter), '') = ''
      or r.hours is null or r.hours < 0.25 or r.hours > 100 or mod(r.hours, 0.25) <> 0
      or r.charged is null or r.charged < 0 or r.charged > 9999999999.99 or r.charged <> round(r.charged, 2)
      or r.paid is null or r.paid < 0 or r.paid > 9999999999.99 or r.paid <> round(r.paid, 2)
  ) then
    raise exception 'Invalid shift in backup' using errcode = '22023';
  end if;

  delete from public.shifts;
  insert into public.shifts (date, family, sitter, shift_type, hours, charged, paid, description)
  select r.date, btrim(r.family), btrim(r.sitter), coalesce(r.shift_type, 'povremeno'),
    r.hours, r.charged, r.paid, nullif(btrim(r.description), '')
  from jsonb_to_recordset(backup_shifts) as r(date date, family text, sitter text, shift_type text,
    hours numeric, charged numeric, paid numeric, description text);
  get diagnostics shift_count = row_count;

  if backup_expenses is not null then
    delete from public.expenses;
    insert into public.expenses (date, title, category, amount, payment_method, description)
    select r.date, btrim(r.title), r.category, r.amount, r.payment_method, nullif(btrim(r.description), '')
    from jsonb_to_recordset(backup_expenses) as r(date date, title text, category text, amount numeric,
      payment_method text, description text);
    get diagnostics expense_count = row_count;
  end if;
  return jsonb_build_object('shifts', shift_count, 'expenses', expense_count);
end;
$$;
revoke all on function public.restore_babyguard_backup(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.restore_babyguard_backup(jsonb, jsonb) to authenticated;
