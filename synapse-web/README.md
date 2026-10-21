# Synapse Web

Marketing site for Synapse Health Companion. It is not the Expo app. The app stays in `synapse-reset/`, and the production Vercel project that serves https://synapse-health.vercel.app should keep building that app.

```bash
cd synapse-web
npm install
npm run dev
```

Open http://localhost:3000.

`npm run test:scene` checks the scroll choreography, including a two-panel subset and the five-panel scene. `npm run test:api` compares `app/api/send-email` with the root Vercel function `api/send-email.ts`.

## Email API

`POST /api/send-email` is the same route the iOS app calls on `https://synapse-health.vercel.app` (`synapse-reset/lib/api.ts`). The root file `api/send-email.ts` stays where it is so the current Vercel project can be rolled back. This Next route is what answers that path after the project root directory becomes `synapse-web`.

It expects the same server environment variables: `API_SHARED_SECRET`, `RESEND_API_KEY`, and optional `RESEND_FROM_EMAIL`. No other root `api/*` function exists. Document analysis, health insights, and medication comparison are Express routes in `server/routes.ts`; they are not Vercel functions in this repo.

Sign-up mail redirects to `/` and password-reset mail can redirect to `/reset-password`. Those pages tell the person to finish in the iPhone app. They do not set a password or store the token.

## Preview

This app is not wired to the production Vercel project. To preview it hosted, create a **new** Vercel project (do not change the existing one’s root, build, or domain) with:

- Root directory: `synapse-web`
- Framework: Next.js
- Set `NEXT_PUBLIC_SITE_URL` to that preview’s origin so canonical URLs and the sitemap match it.

`?phase=INTRO` (or `SCATTERED`, `DISCONNECTION`, `RELEASE`, `FALL`, `STACK`, `ALIGN`, `MERGE`, `REVEAL`) holds the studio on that beat.

See `AUDIT.md` for what was verified, and `ASSET-SPEC.md` for the studio contract.
