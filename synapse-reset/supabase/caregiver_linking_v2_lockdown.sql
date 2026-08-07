-- Caregiver Linking v2 lockdown
-- Removes world-readable/writable RLS policies that used USING (true).
-- Until caregiver tables are gated by Supabase Auth (auth.uid()) or Edge Functions
-- with the service role, client (anon) access must be denied.
--
-- Apply in the Supabase SQL editor after caregiver_linking_v1.sql.
-- Local on-device caregiver mode in the app does NOT need these tables.

alter table public.caregiver_users enable row level security;
alter table public.caregiver_link_codes enable row level security;
alter table public.caregiver_events enable row level security;

drop policy if exists caregiver_users_v1_client_access on public.caregiver_users;
drop policy if exists caregiver_link_codes_v1_client_access on public.caregiver_link_codes;
drop policy if exists caregiver_events_v1_client_access on public.caregiver_events;

-- Deny all access via the anon/authenticated PostgREST roles.
-- Service role (Edge Functions) bypasses RLS and remains usable for push delivery.
drop policy if exists caregiver_users_v2_deny_client on public.caregiver_users;
create policy caregiver_users_v2_deny_client
  on public.caregiver_users for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists caregiver_link_codes_v2_deny_client on public.caregiver_link_codes;
create policy caregiver_link_codes_v2_deny_client
  on public.caregiver_link_codes for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists caregiver_events_v2_deny_client on public.caregiver_events;
create policy caregiver_events_v2_deny_client
  on public.caregiver_events for all
  to anon, authenticated
  using (false)
  with check (false);
