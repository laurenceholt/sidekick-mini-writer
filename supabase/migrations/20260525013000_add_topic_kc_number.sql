alter table public.mini_writer_kcs
  add column if not exists topic integer not null default 6,
  add column if not exists kc_number integer not null default 1;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mini_writer_kcs'
      and column_name = 'unit'
  ) then
    update public.mini_writer_kcs
    set topic = unit
    where unit is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mini_writer_kcs'
      and column_name = 'lesson'
  ) then
    update public.mini_writer_kcs
    set kc_number = lesson
    where lesson is not null;
  end if;
end $$;
