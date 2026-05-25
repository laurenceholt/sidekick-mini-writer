alter table public.mini_writer_minis
  add column if not exists status text not null default 'not_started';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mini_writer_minis_status_check'
  ) then
    alter table public.mini_writer_minis
      add constraint mini_writer_minis_status_check
      check (status in ('not_started', 'writing', 'ready_for_review', 'done'));
  end if;
end $$;

update public.mini_writer_minis
set status = 'writing'
where current_version_id is not null
  and status = 'not_started';
