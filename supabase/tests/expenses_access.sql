-- Run the whole file as postgres in the SQL editor. All test writes are rolled back.
begin;
do $$
declare
  marko uuid;
  ana uuid;
  test_id uuid;
  changed integer;
  original_shifts jsonb;
  original_expenses jsonb;
  after_shifts jsonb;
  after_expenses jsonb;
begin
  select user_id into strict marko from babyguard_private.team_members order by user_id limit 1;
  select user_id into strict ana from babyguard_private.team_members order by user_id offset 1 limit 1;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', marko, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.expenses (date, title, category, amount, payment_method)
  values ('2026-11-02', 'AUTOMATED TEST — rolled back', 'domen_hosting', 123.45, 'kartica')
  returning id into test_id;
  if not exists (select 1 from public.expenses where id = test_id and created_by = marko) then
    raise exception 'Author default or team read failed';
  end if;

  -- The other team member sees and edits the same expense.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', ana, 'role', 'authenticated')::text, true);
  update public.expenses set amount = 234.56, payment_method = 'racun' where id = test_id;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Cross-team update failed'; end if;
  begin
    update public.expenses set created_by = ana where id = test_id;
    raise exception 'Author must not be editable';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.expenses (date, title, category, amount, payment_method)
    values ('2026-11-02', 'Invalid', 'ostalo', -1, 'gotovina');
    raise exception 'Negative amount was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.expenses set amount = 1.001 where id = test_id;
    raise exception 'Sub-cent amount was accepted';
  exception when check_violation then null;
  end;

  -- A signed-in account outside the team cannot read, edit, insert or restore.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
  if exists (select 1 from public.expenses) then raise exception 'Non-team read was allowed'; end if;
  update public.expenses set amount = 1 where id = test_id;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Non-team update was allowed'; end if;
  delete from public.expenses where id = test_id;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Non-team delete was allowed'; end if;
  begin
    insert into public.expenses (date, title, category, amount, payment_method)
    values ('2026-11-02', 'Forbidden', 'ostalo', 1, 'gotovina');
    raise exception 'Non-team insert was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.restore_babyguard_backup('[]', '[]');
    raise exception 'Non-team restore was allowed';
  exception when insufficient_privilege then null;
  end;

  set local role anon;
  begin
    perform count(*) from public.expenses;
    raise exception 'Anonymous table access was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.restore_babyguard_backup('[]', '[]');
    raise exception 'Anonymous restore was allowed';
  exception when insufficient_privilege then null;
  end;

  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', marko, 'role', 'authenticated')::text, true);
  select coalesce(jsonb_agg(to_jsonb(s) order by id), '[]') into original_shifts from public.shifts s;
  select coalesce(jsonb_agg(to_jsonb(e) order by id), '[]') into original_expenses from public.expenses e;
  begin
    perform public.restore_babyguard_backup('[]',
      '[{"date":"2026-11-02","title":"Invalid","category":"ostalo","amount":-1,"payment_method":"kartica"}]');
    raise exception 'Invalid restore was accepted';
  exception when check_violation then null;
  end;
  select coalesce(jsonb_agg(to_jsonb(s) order by id), '[]') into after_shifts from public.shifts s;
  select coalesce(jsonb_agg(to_jsonb(e) order by id), '[]') into after_expenses from public.expenses e;
  if after_shifts <> original_shifts or after_expenses <> original_expenses then
    raise exception 'Failed restore did not roll back both ledgers';
  end if;

  perform public.restore_babyguard_backup('[]', null);
  if exists (select 1 from public.shifts) then raise exception 'Legacy shift replacement failed'; end if;
  select coalesce(jsonb_agg(to_jsonb(e) order by id), '[]') into after_expenses from public.expenses e;
  if after_expenses <> original_expenses then raise exception 'Legacy restore changed expenses'; end if;

  perform public.restore_babyguard_backup('[]', '[]');
  if exists (select 1 from public.expenses) then raise exception 'V2 expense replacement failed'; end if;
  perform public.restore_babyguard_backup(
    '[{"date":"2026-11-02","family":"Test","sitter":"Test","hours":1,"charged":100,"paid":60}]',
    '[{"date":"2026-11-02","title":"Test","category":"ostalo","amount":10,"payment_method":"gotovina"}]');
  if (select count(*) from public.shifts) <> 1 or (select count(*) from public.expenses) <> 1 then
    raise exception 'V2 full restore failed';
  end if;
  delete from public.expenses;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Team expense deletion failed'; end if;
end;
$$;
rollback;
