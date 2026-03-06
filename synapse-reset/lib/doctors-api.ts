import { getSupabase } from "@/lib/supabase";
import type { Doctor } from "@/lib/storage";

export async function fetchDoctorsFromSupabase(userId: string): Promise<Doctor[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("doctors")
    .select("id, name, specialty, created_at")
    .eq("user_id", userId)
    .order("name");
  if (error) return [];
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name ?? "",
    specialty: r.specialty ?? undefined,
    created_at: r.created_at,
  }));
}

export async function createDoctorInSupabase(
  userId: string,
  name: string,
  specialty?: string
): Promise<{ doctor: Doctor | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { doctor: null, error: new Error("Supabase not configured") };
  const { data, error } = await supabase
    .from("doctors")
    .insert({ user_id: userId, name: (name ?? "").trim(), specialty: specialty?.trim() ?? null })
    .select("id, name, specialty, created_at")
    .single();
  if (error) return { doctor: null, error: new Error(error.message) };
  return {
    doctor: {
      id: data.id,
      name: data.name ?? "",
      specialty: data.specialty ?? undefined,
      created_at: data.created_at,
    },
    error: null,
  };
}

export async function deleteDoctorFromSupabase(userId: string, doctorId: string): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };
  const { error } = await supabase.from("doctors").delete().eq("user_id", userId).eq("id", doctorId);
  return { error: error ? new Error(error.message) : null };
}
