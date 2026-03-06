# Environment setup (synapse-reset)

## Login (Supabase)

For sign-in to work, the app must be built with your Supabase URL and anon key.

1. **EAS Dashboard** (recommended):  
   [expo.dev](https://expo.dev) → your project → **Environment variables** (or **Secrets**).  
   Add:
   - `EXPO_PUBLIC_SUPABASE_URL` = your Supabase project URL  
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon (public) key  

2. **Rebuild the app** after adding or changing these (e.g. `eas build -p ios --profile production`).  
   They are baked in at build time.

If these are missing, the app will show an error when you try to sign in:  
*"Sign-in is not configured. Add your Supabase URL and anon key in EAS project environment variables, then rebuild the app."*

## Pictures / assets

- **Onboarding**: Uses the Synapse logo component and a person icon (no local image files).  
  If you have `brain-logo.jpeg` or `founder.png`, you can add them under `assets/images/` and the onboarding screen can be updated to use them again.
- **App icon**: `assets/icon.png` (already set).
- Other screens use icons from `@expo/vector-icons` or remote URLs; no extra local image assets are required for the migrated app.
