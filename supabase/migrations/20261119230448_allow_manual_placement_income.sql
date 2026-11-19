-- Accept manually entered placement income while preserving historical records
-- and compatibility with the previously deployed percentage-based form.
alter table public.shifts drop constraint shifts_commission_check;
alter table public.shifts add constraint shifts_commission_check check (
  (shift_type <> 'spajanje' and commission_base is null and commission_percent is null)
  or (shift_type = 'spajanje' and paid = 0
    and charged > 0 and charged <= 9999999999.99 and charged = round(charged, 2)
    and (
      (commission_base is null and commission_percent is null)
      or (commission_base is not null and commission_percent is not null
        and commission_base > 0 and commission_base <= 9999999999.99
        and commission_base = round(commission_base, 2)
        and commission_percent > 0 and commission_percent <= 100
        and commission_percent = round(commission_percent, 2)
        and charged = round(commission_base * commission_percent / 100, 2))
    )
  )
);
