import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Deletes only the authenticated caller. The user id is taken from the
 * verified access token, never from request input.
 */
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Account deletion is not configured on the server" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data, error: userError } = await userClient.auth.getUser();
  if (userError || !data.user) return json({ error: "Your session has expired" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userId = data.user.id;

  // Caregiver tables use text ids and are not linked to auth.users by a
  // foreign key, so remove them explicitly before deleting the Auth user.
  const caregiverDeletes = await Promise.all([
    admin.from("caregiver_events").delete().or(`patient_user_id.eq.${userId},caregiver_user_id.eq.${userId}`),
    admin.from("caregiver_link_codes").delete().or(`patient_user_id.eq.${userId},claimed_by_user_id.eq.${userId}`),
    admin.from("caregiver_users").delete().eq("user_id", userId),
  ]);
  const caregiverError = caregiverDeletes.find((result) => result.error)?.error;
  if (caregiverError) return json({ error: "Could not remove caregiver data" }, 500);

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return json({ error: "Could not delete your account" }, 500);

  return json({ deleted: true });
});
