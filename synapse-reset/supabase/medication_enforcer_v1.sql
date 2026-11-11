-- Medication Enforcer v1: owner allowlist and private records.
-- Apply this migration before enabling the client feature flag. The allowlist is
-- populated only by a trusted admin/service-role process after verifying the
-- owner's Apple-authenticated account; ordinary clients can never grant access.

create table if not exists public.medication_enforcer_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.medication_enforcer_configs (
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id text not null,
  enabled boolean not null default false,
  mode text not null default 'strict' check (mode = 'strict'),
  escalation_offsets_min integer[] not null default '{5,10,15}',
  allow_snooze boolean not null default true,
  max_snoozes integer not null default 3 check (max_snoozes between 0 and 10),
  show_medication_name_on_lock_screen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, medication_id)
);

create table if not exists public.medication_enforcer_doses (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id text not null,
  scheduled_at timestamptz not null,
  state text not null check (state in ('scheduled','due','escalating','snoozed','awaiting_decision','resolved')),
  resolution text check (resolution is null or resolution in ('taken','not_taken','deferred_by_clinician','canceled_schedule_change','unresolved')),
  actual_taken_at timestamptz,
  resolved_at timestamptz,
  snooze_count integer not null default 0 check (snooze_count >= 0),
  last_escalation_level integer not null default 0 check (last_escalation_level >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, medication_id, scheduled_at)
);

create table if not exists public.medication_enforcer_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  dose_id uuid not null references public.medication_enforcer_doses(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (dose_id, event_type, occurred_at)
);

alter table public.medication_enforcer_entitlements enable row level security;
alter table public.medication_enforcer_configs enable row level security;
alter table public.medication_enforcer_doses enable row level security;
alter table public.medication_enforcer_events enable row level security;

drop policy if exists medication_enforcer_entitlement_owner_read on public.medication_enforcer_entitlements;
create policy medication_enforcer_entitlement_owner_read on public.medication_enforcer_entitlements
  for select to authenticated using (user_id = auth.uid());

drop policy if exists medication_enforcer_config_owner_access on public.medication_enforcer_configs;
create policy medication_enforcer_config_owner_access on public.medication_enforcer_configs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists medication_enforcer_dose_owner_access on public.medication_enforcer_doses;
create policy medication_enforcer_dose_owner_access on public.medication_enforcer_doses
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists medication_enforcer_event_owner_access on public.medication_enforcer_events;
create policy medication_enforcer_event_owner_access on public.medication_enforcer_events
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- No anon access and no client write policy exists for entitlements.
revoke all on public.medication_enforcer_entitlements from anon, authenticated;
grant select on public.medication_enforcer_entitlements to authenticated;
