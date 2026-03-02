-- Run this in Supabase: SQL Editor → New query → paste and Run
-- Creates: user_backups (backup/restore), doctors, appointments

-- 1. user_backups (for Backup now / Restore)
DROP TABLE IF EXISTS public.user_backups;

CREATE TABLE public.user_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_backups_user_id ON public.user_backups(user_id);

ALTER TABLE public.user_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own backup"
  ON public.user_backups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own backup"
  ON public.user_backups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own backup"
  ON public.user_backups FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own backup"
  ON public.user_backups FOR DELETE
  USING (auth.uid() = user_id);

-- 2. doctors (Settings → Doctors, appointment form)
CREATE TABLE IF NOT EXISTS public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  specialty text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON public.doctors(user_id);

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own doctors" ON public.doctors;
CREATE POLICY "Users can select own doctors"
  ON public.doctors FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own doctors" ON public.doctors;
CREATE POLICY "Users can insert own doctors"
  ON public.doctors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own doctors" ON public.doctors;
CREATE POLICY "Users can update own doctors"
  ON public.doctors FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own doctors" ON public.doctors;
CREATE POLICY "Users can delete own doctors"
  ON public.doctors FOR DELETE
  USING (auth.uid() = user_id);

-- 3. appointments (synced across devices when signed in)
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id uuid,
  doctor_name text NOT NULL,
  specialty text DEFAULT '',
  date date NOT NULL,
  time text NOT NULL DEFAULT '09:00',
  location text DEFAULT '',
  notes text DEFAULT '',
  is_recurring boolean DEFAULT false,
  repeat_interval integer,
  repeat_unit text CHECK (repeat_unit IN ('day', 'week', 'month')),
  repeat_end_date date,
  parent_recurring_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON public.appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user_date ON public.appointments(user_id, date);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own appointments" ON public.appointments;
CREATE POLICY "Users can select own appointments"
  ON public.appointments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own appointments" ON public.appointments;
CREATE POLICY "Users can insert own appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own appointments" ON public.appointments;
CREATE POLICY "Users can update own appointments"
  ON public.appointments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own appointments" ON public.appointments;
CREATE POLICY "Users can delete own appointments"
  ON public.appointments FOR DELETE
  USING (auth.uid() = user_id);
