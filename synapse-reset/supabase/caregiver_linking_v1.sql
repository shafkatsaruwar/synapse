-- Caregiver Linking System v1
-- Minimal backend for patient-approved linking and signals-based caregiver events.

create table if not exists public.caregiver_users (
  user_id text primary key,
  role text not null check (role in ('patient', 'caregiver')),
  linked_users text[] not null default '{}',
  device_token text,
  updated_at timestamptz not null default now()
);

create table if not exists public.caregiver_link_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  patient_user_id text not null references public.caregiver_users(user_id) on delete cascade,
  expires_at timestamptz not null,
  claimed_by_user_id text references public.caregiver_users(user_id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.caregiver_events (
  id uuid primary key default gen_random_uuid(),
  patient_user_id text not null references public.caregiver_users(user_id) on delete cascade,
  caregiver_user_id text not null references public.caregiver_users(user_id) on delete cascade,
  type text not null check (
    type in (
      'missed_medication',
      'missed_appointment',
      'sick_mode_activated',
      'no_activity',
      'no_logs_today',
      'recovery_mode_active',
      'caregiver_reminder'
    )
  ),
  event_key text not null,
  payload jsonb not null default '{}',
  acknowledged_at timestamptz,
  acknowledged_by_user_id text,
  created_at timestamptz not null default now(),
  unique (patient_user_id, caregiver_user_id, event_key)
);

create index if not exists caregiver_link_codes_active_idx
  on public.caregiver_link_codes (code, expires_at)
  where claimed_at is null;

create index if not exists caregiver_events_caregiver_idx
  on public.caregiver_events (caregiver_user_id, created_at desc);

alter table public.caregiver_events
  drop constraint if exists caregiver_events_type_check;

alter table public.caregiver_events
  add constraint caregiver_events_type_check
  check (
    type in (
      'missed_medication',
      'missed_appointment',
      'sick_mode_activated',
      'no_activity',
      'no_logs_today',
      'recovery_mode_active',
      'caregiver_reminder'
    )
  );

-- RLS is intentionally permissive for local install IDs. If you move fully to
-- Supabase Auth IDs, replace these with auth.uid()-based policies.
alter table public.caregiver_users enable row level security;
alter table public.caregiver_link_codes enable row level security;
alter table public.caregiver_events enable row level security;

drop policy if exists caregiver_users_v1_client_access on public.caregiver_users;
create policy caregiver_users_v1_client_access
  on public.caregiver_users for all
  using (true)
  with check (true);

drop policy if exists caregiver_link_codes_v1_client_access on public.caregiver_link_codes;
create policy caregiver_link_codes_v1_client_access
  on public.caregiver_link_codes for all
  using (true)
  with check (true);

drop policy if exists caregiver_events_v1_client_access on public.caregiver_events;
create policy caregiver_events_v1_client_access
  on public.caregiver_events for all
  using (true)
  with check (true);

-- Push delivery:
-- Add Supabase Edge Functions named:
--   send-caregiver-event
--   send-caregiver-reminder
-- They should read caregiver_users.device_token and call Expo Push API server-side.
