// Supabase Edge Function: delete-account
//
// Implements App Store Guideline 5.1.1(v): a signed-in user can permanently
// delete their account and all associated server-side data from inside the app.
//
// Security model:
//   - The caller MUST present a valid Supabase user JWT (Authorization: Bearer <token>).
//   - We verify the token server-side and only ever delete data for THAT user id.
//   - The service role key (which bypasses RLS) never leaves the server.
//
// Deploy:
//   supabase functions deploy delete-account
// Required function secrets (Project Settings -> Edge Functions):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server is not configured for account deletion." }, 500);
  }

  // Extract and verify the caller's JWT. We never trust a user id from the body.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json({ error: "Missing authentication token." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userError || !userId) {
    return json({ error: "Invalid or expired session." }, 401);
  }

  const failures: string[] = [];

  // Delete user-owned rows. These tables key off the auth user id.
  const ownedTables: { table: string; column: string }[] = [
    { table: "user_backups", column: "user_id" },
    { table: "doctors", column: "user_id" },
    { table: "appointments", column: "user_id" },
  ];
  for (const { table, column } of ownedTables) {
    const { error } = await admin.from(table).delete().eq(column, userId);
    if (error && error.code !== "42P01") {
      // 42P01 = undefined_table: tolerate tables that don't exist in this project.
      failures.push(`${table}: ${error.message}`);
    }
  }

  // Best-effort cleanup of caregiver-linking rows that reference this user id.
  const caregiverCleanup: { table: string; column: string }[] = [
    { table: "caregiver_events", column: "patient_user_id" },
    { table: "caregiver_events", column: "caregiver_user_id" },
    { table: "caregiver_link_codes", column: "patient_user_id" },
    { table: "caregiver_link_codes", column: "claimed_by_user_id" },
    { table: "caregiver_users", column: "user_id" },
  ];
  for (const { table, column } of caregiverCleanup) {
    const { error } = await admin.from(table).delete().eq(column, userId);
    if (error && error.code !== "42P01") {
      failures.push(`${table}.${column}: ${error.message}`);
    }
  }

  // Finally, delete the auth user itself.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return json(
      { error: "Could not delete your account. Please try again or contact support.", details: deleteError.message },
      500,
    );
  }

  return json({ success: true, deletedUserId: userId, dataWarnings: failures });
});
