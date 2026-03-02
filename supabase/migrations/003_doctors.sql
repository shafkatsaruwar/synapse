-- doctors: user's doctors for appointments (RLS)
create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  specialty text,
  created_at timestamptz not null default now()
);

create index idx_doctors_user_id on public.doctors(user_id);

alter table public.doctors enable row level security;

create policy "Users can select own doctors"
  on public.doctors for select
  using (auth.uid() = user_id);

create policy "Users can insert own doctors"
  on public.doctors for insert
  with check (auth.uid() = user_id);

create policy "Users can update own doctors"
  on public.doctors for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own doctors"
  on public.doctors for delete
  using (auth.uid() = user_id);
