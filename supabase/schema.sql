create extension if not exists pgcrypto;

create table if not exists public.kcs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  grade integer not null default 6,
  unit integer not null default 6,
  lesson integer not null default 1,
  condition text not null default '',
  response text not null default '',
  worked_example_md text not null default '',
  standards jsonb not null default '[]'::jsonb,
  notes_md text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.minis (
  id uuid primary key default gen_random_uuid(),
  kc_id uuid not null references public.kcs(id) on delete cascade,
  mini_index integer not null check (mini_index between 1 and 4),
  title text not null,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kc_id, mini_index)
);

create table if not exists public.mini_versions (
  id uuid primary key default gen_random_uuid(),
  mini_id uuid not null references public.minis(id) on delete cascade,
  version_number integer not null,
  source text not null check (source in ('seed', 'generate', 'manual', 'agent', 'notes', 'revert')),
  summary text not null default '',
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (mini_id, version_number)
);

alter table public.minis
  add constraint minis_current_version_id_fkey
  foreign key (current_version_id) references public.mini_versions(id);

create table if not exists public.feedback_log (
  id uuid primary key default gen_random_uuid(),
  kc_id uuid references public.kcs(id) on delete set null,
  mini_id uuid references public.minis(id) on delete set null,
  before_version_id uuid references public.mini_versions(id) on delete set null,
  after_version_id uuid references public.mini_versions(id) on delete set null,
  event_type text not null,
  writer_input text not null default '',
  agent_response text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_kcs_updated_at on public.kcs;
create trigger set_kcs_updated_at
before update on public.kcs
for each row execute function public.set_updated_at();

drop trigger if exists set_minis_updated_at on public.minis;
create trigger set_minis_updated_at
before update on public.minis
for each row execute function public.set_updated_at();

alter table public.kcs enable row level security;
alter table public.minis enable row level security;
alter table public.mini_versions enable row level security;
alter table public.feedback_log enable row level security;
