/**
 * Expo app config.
 *
 * Production (EAS Build): set in EAS project environment variables or .env when running `eas build`:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 * These are inlined at build time via process.env in the app.
 */
const appJson = require("./app.json");

module.exports = {
  ...appJson,
};
