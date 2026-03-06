# Sign-in: set once, never worry again

Do this **once**. After that, every EAS build (TestFlight, store) will have sign-in working. No EAS dashboard, no env vars to remember.

## 1. Get your Supabase values

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Project Settings** (gear) → **API**.
3. Copy:
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

## 2. Put them in `.env`

In the **synapse-reset** folder, open (or create) `.env` and set exactly:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-actual-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-actual-anon-key...
```

No quotes, no spaces around `=`. One line per variable.

## 3. Commit and push

From the repo root:

```bash
git add synapse-reset/.env
git commit -m "Add Supabase .env for sign-in"
git push
```

The anon key is meant to be public (client-side); committing it is normal and safe.

## 4. Build

```bash
cd synapse-reset && eas build -p ios --profile production
```

Install the new build from TestFlight. Sign-in will work. Every **future** build will also have sign-in, because `.env` is now in the repo and gets loaded when the app is built.

You’re done. No EAS env vars, no dashboards—just commit `.env` and build.
