# Environment setup (synapse-reset)

## Shipping the app — sign-in for real users

**Option A: .env file (reliable for EAS)**

1. In the **synapse-reset** folder: `cp .env.example .env`
2. Edit **.env** and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (get them from [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Project Settings** → **API**).
3. **Commit .env** so EAS Build has the values: `git add -f synapse-reset/.env` then commit. (Supabase anon key is public by design. If .env is in .gitignore, use `-f` to add it.)
4. Run a new build: `eas build -p ios --profile production`

The app loads `.env` in `app.config.js`, so when EAS runs the build it will have these values and sign-in will work.

**Option B: Expo project environment variables**

In expo.dev → your Synapse project → **Project settings** → **Environment variables**, add the same two variables for production. Then run a new build. If sign-in still fails, use Option A (.env) instead.

After either option, users only see the normal Sign In / Create account screen.

## Pictures / assets

- **Onboarding**: Uses Synapse logo and founder image from `assets/images/founder.png`.
- **App icon**: `assets/icon.png`.
- Other screens use icons from `@expo/vector-icons` or remote URLs.
