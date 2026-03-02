# Supabase auth: confirmation emails not arriving

If users don’t receive sign-up or password-reset emails, work through this checklist in the **Supabase Dashboard**.

## 1. Confirm email is enabled

- **Authentication → Providers → Email**
- Ensure **“Confirm email”** is **ON** if you want new sign-ups to receive a confirmation email.
- If it’s OFF, Supabase does not send any confirmation email (users are active immediately).

## 2. Redirect URLs (required for confirmation links)

The link in the email must point to a URL that Supabase allows.

- **Authentication → URL Configuration**
- **Redirect URLs:** Add every URL where your app runs, for example:
  - `https://synapse-health.vercel.app/**`
  - `https://your-production-domain.com/**`
  - `http://localhost:8081/**` (Expo web)
- **Site URL:** Set to your main app URL (e.g. `https://synapse-health.vercel.app`). This is used when no `emailRedirectTo` is sent.

Without these, the confirmation link can be rejected or redirect to the wrong place.

## 3. App URL for redirect (optional env)

The app sends `emailRedirectTo` so the confirmation link opens your app.

- **Web:** If `EXPO_PUBLIC_APP_URL` is not set, the code falls back to `window.location.origin` so the current site is used.
- **Production:** Set `EXPO_PUBLIC_APP_URL` to your production URL (e.g. `https://synapse-health.vercel.app`) in Vercel/hosting env vars so email links always point there.

## 4. Email deliverability (most common cause of “no email”)

Supabase’s built-in sender has limits and often lands in **spam** or is blocked.

- **Authentication → Email Templates:** You can edit the “Confirm signup” template; the main fix is usually deliverability (below).
- **Use custom SMTP** so emails are sent from your domain and are less likely to be filtered:
  - **Project Settings → Auth → SMTP**
  - Enable **Custom SMTP** and use a provider such as:
    - **Resend** (resend.com)
    - **SendGrid**
    - **Mailgun**
    - **AWS SES**
  - Use the “from” address and domain you control (e.g. `noreply@yourdomain.com`).

After setting SMTP, send a test sign-up to the same address and check inbox and spam.

## 5. Quick checklist

- [ ] **Confirm email** is ON (Authentication → Providers → Email) if you want confirmation emails.
- [ ] **Redirect URLs** include your app URL(s) (Authentication → URL Configuration).
- [ ] **Site URL** is your production URL (Authentication → URL Configuration).
- [ ] **Custom SMTP** is configured (Project Settings → Auth → SMTP) for better deliverability.
- [ ] `EXPO_PUBLIC_APP_URL` is set in production to your app URL (optional but recommended).
