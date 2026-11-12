-- Owner-only Synapse Plus purchase alerts (App Store Server Notifications V2 → Expo Push).
-- Apply in the Supabase SQL editor. Do not expose these tables to anon/authenticated clients.
-- Service role (Edge Functions) bypasses RLS.

create table if not exists public.owner_push_devices (
  id uuid primary key default gen_random_uuid(),
  expo_push_token text not null,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  disabled_at timestamptz,
  disable_reason text,
  constraint owner_push_devices_token_unique unique (expo_push_token),
  constraint owner_push_devices_token_format check (expo_push_token like 'ExponentPushToken%')
);

create table if not exists public.plus_purchase_notification_events (
  notification_uuid text primary key,
  environment text not null check (environment in ('Production', 'Sandbox')),
  notification_type text not null,
  subtype text,
  product_id text,
  transaction_id text,
  original_transaction_id text,
  alert_sent boolean not null default false,
  skip_reason text,
  created_at timestamptz not null default now()
);

create index if not exists plus_purchase_notification_events_tx_idx
  on public.plus_purchase_notification_events (transaction_id)
  where transaction_id is not null;

create index if not exists owner_push_devices_active_idx
  on public.owner_push_devices (updated_at desc)
  where disabled_at is null;

alter table public.owner_push_devices enable row level security;
alter table public.plus_purchase_notification_events enable row level security;

drop policy if exists owner_push_devices_deny_client on public.owner_push_devices;
create policy owner_push_devices_deny_client
  on public.owner_push_devices for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists plus_purchase_notification_events_deny_client on public.plus_purchase_notification_events;
create policy plus_purchase_notification_events_deny_client
  on public.plus_purchase_notification_events for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table public.owner_push_devices is
  'Authorized owner iPhones for Synapse Plus purchase celebration pushes. Service role only.';
comment on table public.plus_purchase_notification_events is
  'Deduped App Store Server Notification V2 events for Plus purchase alerts. No customer PHI.';
