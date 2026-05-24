create table if not exists public.mini_writer_writers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.mini_writer_writers (name)
values ('Laurence')
on conflict (name) do nothing;

alter table public.mini_writer_kcs
  add column if not exists writer_id uuid references public.mini_writer_writers(id) on delete set null;

do $$
declare
  default_writer_id uuid;
begin
  select id into default_writer_id
  from public.mini_writer_writers
  where name = 'Laurence';

  update public.mini_writer_kcs
  set writer_id = default_writer_id
  where writer_id is null;
end $$;

drop trigger if exists mini_writer_set_writers_updated_at on public.mini_writer_writers;
create trigger mini_writer_set_writers_updated_at
before update on public.mini_writer_writers
for each row execute function public.mini_writer_set_updated_at();

alter table public.mini_writer_writers enable row level security;
