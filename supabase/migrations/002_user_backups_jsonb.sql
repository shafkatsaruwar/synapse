-- Replace user_backups with new schema: id, user_id, data (jsonb), created_at, updated_at
drop table if exists public.user_backups;

create table public.user_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_user_backups_user_id on public.user_backups(user_id);

alter table public.user_backups enable row level security;

create policy "Users can select own backup"
  on public.user_backups for select
  using (auth.uid() = user_id);

create policy "Users can insert own backup"
  on public.user_backups for insert
  with check (auth.uid() = user_id);

create policy "Users can update own backup"
  on public.user_backups for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own backup"
  on public.user_backups for delete
  using (auth.uid() = user_id);
