alter table public.mini_writer_kcs
  add column if not exists deleted_at timestamptz;

alter table public.mini_writer_minis
  add column if not exists deleted_at timestamptz;

alter table public.mini_writer_mini_versions
  add column if not exists deleted_at timestamptz;
