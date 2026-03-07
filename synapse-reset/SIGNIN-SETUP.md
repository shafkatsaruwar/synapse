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

---

## "Network request failed" or can't sign in

- **TestFlight / installed app:** The app was built earlier. Changing `.env` on your computer now does **not** change that build. You must **commit** `.env` (repo root or `synapse-reset/.env`) and run a **new** `eas build`, then install the new build.
- **Expo dev (`npx expo start`):** After changing `.env`, **restart** the dev server (stop and run `npx expo start` again) so the config is reloaded.
- **Supabase URL:** Must be `https://` (not `http://`), no trailing slash, and the project ref must be correct (Supabase Dashboard → Settings → API → Project URL). If the project is paused (free tier), resume it in the dashboard.
- **Where to put `.env`:** Either repo root or `synapse-reset/`. The app loads both. Variable names must be exactly `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **Vercel URL:** Used for email confirmation links (sign-up), not for the sign-in request. Sign-in talks to Supabase only. If only sign-in fails, the problem is Supabase URL/network, not Vercel.
- **Still "network request failed"?** (1) In Supabase Dashboard → Project Settings → API, confirm the project is **not paused** (resume if needed). (2) Copy the **Project URL** again and ensure it matches exactly in `.env` (no trailing slash, `https://`). (3) Run a **new** EAS build after any `.env` change and install that build. (4) On device, open Safari and visit your Supabase Project URL—if it doesn’t load, it’s a network/DNS issue on that device.
