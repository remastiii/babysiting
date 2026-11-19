-- Placements share the service ledger, but have no worked hours or sitter payout.
-- Preserve all existing rows, grants and access policies.
alter table public.shifts
  add column commission_base numeric,
  add column commission_percent numeric;

alter table public.shifts drop constraint shifts_shift_type_check;
alter table public.shifts add constraint shifts_shift_type_check
  check (shift_type in ('povremeno', 'nocno', 'hotelsko', 'hitno', 'proslave', 'spajanje'));
alter table public.shifts drop constraint shifts_hours_check;
alter table public.shifts add constraint shifts_hours_check
  check ((shift_type = 'spajanje' and hours = 0) or (shift_type <> 'spajanje' and hours > 0));
alter table public.shifts add constraint shifts_commission_check check (
  (shift_type <> 'spajanje' and commission_base is null and commission_percent is null)
  or (shift_type = 'spajanje'
    and commission_base is not null and commission_percent is not null
    and commission_base > 0 and commission_base <= 9999999999.99
    and commission_base = round(commission_base, 2)
    and commission_percent > 0 and commission_percent <= 100
    and commission_percent = round(commission_percent, 2)
    and paid = 0 and charged > 0
    and charged = round(commission_base * commission_percent / 100, 2))
);

create or replace function public.restore_babyguard_backup(backup_shifts jsonb, backup_expenses jsonb default null)
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

  lock table public.shifts, public.expenses in share row exclusive mode;
  if exists (
    select 1 from jsonb_to_recordset(backup_shifts) as r(date date, family text, sitter text,
      shift_type text, hours numeric, charged numeric, paid numeric)
    where r.date is null or coalesce(btrim(r.family), '') = '' or coalesce(btrim(r.sitter), '') = ''
      or r.hours is null
      or (coalesce(r.shift_type, 'povremeno') <> 'spajanje'
        and (r.hours < 0.25 or r.hours > 100 or mod(r.hours, 0.25) <> 0))
      or r.charged is null or r.charged < 0 or r.charged > 9999999999.99 or r.charged <> round(r.charged, 2)
      or r.paid is null or r.paid < 0 or r.paid > 9999999999.99 or r.paid <> round(r.paid, 2)
  ) then
    raise exception 'Invalid service in backup' using errcode = '22023';
  end if;

  delete from public.shifts;
  insert into public.shifts (date, family, sitter, shift_type, hours, charged, paid, description,
    commission_base, commission_percent)
  select r.date, btrim(r.family), btrim(r.sitter), coalesce(r.shift_type, 'povremeno'),
    r.hours, r.charged, r.paid, nullif(btrim(r.description), ''), r.commission_base, r.commission_percent
  from jsonb_to_recordset(backup_shifts) as r(date date, family text, sitter text, shift_type text,
    hours numeric, charged numeric, paid numeric, description text, commission_base numeric, commission_percent numeric);
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
