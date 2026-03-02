import { supabase } from "@/lib/supabase";
import type { Doctor } from "@/lib/storage";

export async function fetchDoctorsFromSupabase(userId: string): Promise<Doctor[]> {
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
  const { data, error } = await supabase
    .from("doctors")
    .insert({ user_id: userId, name: name.trim(), specialty: specialty?.trim() ?? null })
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
