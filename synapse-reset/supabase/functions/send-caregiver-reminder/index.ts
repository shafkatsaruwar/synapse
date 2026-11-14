/**
 * SHIELD-005 Option B — fail closed.
 * Cloud caregiver push is disabled until auth-bound migration (Option A).
 * This source change does not affect production until an approved deploy.
 * Do not restore push logic here without verified JWT + link ownership checks.
 */
Deno.serve((_req) => {
  return Response.json(
    {
      error:
        "Cloud caregiver push is disabled (SHIELD-005 Option B). Re-enable only after auth-bound caregiver identities and JWT authorization.",
      code: "CLOUD_CAREGIVER_PUSH_DISABLED",
    },
    { status: 503 }
  );
});
