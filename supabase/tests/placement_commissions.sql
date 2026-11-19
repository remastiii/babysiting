-- Run the whole file. Every write, including backup restore, is rolled back.
begin;
do $$
declare
  member_id uuid;
  placement_id uuid;
  snapshot jsonb;
  restored jsonb;
begin
  select user_id into strict member_id from babyguard_private.team_members order by user_id limit 1;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', member_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.shifts (date, family, sitter, shift_type, hours, charged, paid, commission_base, commission_percent)
  values ('2026-11-19', 'AUTOMATED TEST — rolled back', 'Placement test', 'spajanje', 0, 16000, 0, 80000, 20)
  returning id into placement_id;
  update public.shifts set commission_percent = 25, charged = 20000 where id = placement_id;
  if not exists (select 1 from public.shifts where id = placement_id and charged = 20000 and paid = 0 and hours = 0) then
    raise exception 'Placement insert/update failed';
  end if;
  begin
    update public.shifts set paid = 1 where id = placement_id;
    raise exception 'Placement sitter payout was accepted';
  exception when check_violation then null; end;
  begin
    update public.shifts set hours = 1 where id = placement_id;
    raise exception 'Placement worked hours were accepted';
  exception when check_violation then null; end;
  begin
    update public.shifts set commission_percent = 101 where id = placement_id;
    raise exception 'Invalid percentage was accepted';
  exception when check_violation then null; end;
  begin
    update public.shifts set commission_base = null where id = placement_id;
    raise exception 'Missing principal was accepted';
  exception when check_violation then null; end;
  begin
    update public.shifts set charged = 80000 where id = placement_id;
    raise exception 'Principal was accepted as commission revenue';
  exception when check_violation then null; end;

  select coalesce(jsonb_agg(to_jsonb(s) order by id), '[]') into snapshot from public.shifts s;
  perform public.restore_babyguard_backup(snapshot, null);
  if not exists (select 1 from public.shifts where family = 'AUTOMATED TEST — rolled back'
    and shift_type = 'spajanje' and commission_base = 80000 and commission_percent = 25
    and charged = 20000 and paid = 0 and hours = 0) then
    raise exception 'Backup lost placement fields';
  end if;
  select coalesce(jsonb_agg(to_jsonb(s) order by id), '[]') into snapshot from public.shifts s;
  begin
    perform public.restore_babyguard_backup('[{"date":"2026-11-19","family":"Invalid","sitter":"Test",
      "shift_type":"spajanje","hours":0,"charged":10,"paid":10,"commission_base":100,"commission_percent":10}]', null);
    raise exception 'Invalid commission backup was accepted';
  exception when check_violation then null; end;
  select coalesce(jsonb_agg(to_jsonb(s) order by id), '[]') into restored from public.shifts s;
  if restored <> snapshot then raise exception 'Invalid backup changed existing data'; end if;

  -- Existing percentage records can be edited into a direct amount.
  update public.shifts set charged = 23456.78, commission_base = null, commission_percent = null
  where family = 'AUTOMATED TEST — rolled back';
  insert into public.shifts (date, family, sitter, shift_type, hours, charged, paid)
  values ('2026-11-20', 'MANUAL TEST — rolled back', 'Placement test', 'spajanje', 0, 15000, 0)
  returning id into placement_id;
  update public.shifts set charged = 16000.50 where id = placement_id;
  if not exists (select 1 from public.shifts where id = placement_id and charged = 16000.50
    and paid = 0 and hours = 0 and commission_base is null and commission_percent is null) then
    raise exception 'Manual placement insert/update failed';
  end if;
  begin
    update public.shifts set charged = 0 where id = placement_id;
    raise exception 'Zero manual income was accepted';
  exception when check_violation then null; end;
  begin
    update public.shifts set charged = 1.001 where id = placement_id;
    raise exception 'Sub-cent manual income was accepted';
  exception when check_violation then null; end;
  begin
    update public.shifts set paid = 1 where id = placement_id;
    raise exception 'Manual placement sitter payout was accepted';
  exception when check_violation then null; end;
  begin
    update public.shifts set hours = 1 where id = placement_id;
    raise exception 'Manual placement worked hours were accepted';
  exception when check_violation then null; end;
  select coalesce(jsonb_agg(to_jsonb(s) order by id), '[]') into snapshot from public.shifts s;
  perform public.restore_babyguard_backup(snapshot, null);
  if not exists (select 1 from public.shifts where family = 'MANUAL TEST — rolled back'
    and charged = 16000.50 and paid = 0 and hours = 0 and commission_base is null and commission_percent is null) then
    raise exception 'Backup lost manual placement income';
  end if;

  perform public.restore_babyguard_backup('[{"date":"2026-11-19","family":"Legacy","sitter":"Test",
    "hours":1,"charged":100,"paid":60}]', null);
  if not exists (select 1 from public.shifts where shift_type = 'povremeno' and hours = 1
    and commission_base is null and commission_percent is null) then
    raise exception 'Legacy shift backup failed';
  end if;
end;
$$;
rollback;
