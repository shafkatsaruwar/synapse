-- appointments: synced per user (RLS) so web and phone see the same data
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doctor_id uuid,
  doctor_name text not null,
  specialty text default '',
  date date not null,
  time text not null default '09:00',
  location text default '',
  notes text default '',
  is_recurring boolean default false,
  repeat_interval integer,
  repeat_unit text check (repeat_unit in ('day', 'week', 'month')),
  repeat_end_date date,
  parent_recurring_id uuid,
  created_at timestamptz not null default now()
);

create index idx_appointments_user_id on public.appointments(user_id);
create index idx_appointments_user_date on public.appointments(user_id, date);

alter table public.appointments enable row level security;

create policy "Users can select own appointments"
  on public.appointments for select
  using (auth.uid() = user_id);

create policy "Users can insert own appointments"
  on public.appointments for insert
  with check (auth.uid() = user_id);

create policy "Users can update own appointments"
  on public.appointments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own appointments"
  on public.appointments for delete
  using (auth.uid() = user_id);
