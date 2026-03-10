import { getSupabase } from "@/lib/supabase";
import type { Appointment } from "@/lib/storage";

function rowToAppointment(r: Record<string, unknown>): Appointment {
  return {
    id: r.id as string,
    doctor_id: (r.doctor_id as string) ?? undefined,
    doctorName: (r.doctor_name as string) ?? "",
    specialty: (r.specialty as string) ?? "",
    date: (r.date as string) ?? "",
    time: (r.time as string) ?? "09:00",
    location: (r.location as string) ?? "",
    notes: (r.notes as string) ?? "",
    is_recurring: (r.is_recurring as boolean) ?? false,
    repeat_interval: r.repeat_interval as number | undefined,
    repeat_unit: r.repeat_unit as "day" | "week" | "month" | undefined,
    repeat_end_date: (r.repeat_end_date as string) ?? undefined,
    parent_recurring_id: (r.parent_recurring_id as string) ?? undefined,
    status: (r.status as Appointment["status"]) ?? undefined,
  };
}

function appointmentToRow(apt: Appointment | (Omit<Appointment, "id"> & { id?: string }), userId: string): Record<string, unknown> {
  return {
    ...("id" in apt && apt.id ? { id: apt.id } : {}),
    user_id: userId,
    doctor_id: apt.doctor_id ?? null,
    doctor_name: apt.doctorName,
    specialty: apt.specialty ?? "",
    date: apt.date,
    time: apt.time ?? "09:00",
    location: apt.location ?? "",
    notes: apt.notes ?? "",
    is_recurring: apt.is_recurring ?? false,
    repeat_interval: apt.repeat_interval ?? null,
    repeat_unit: apt.repeat_unit ?? null,
    repeat_end_date: apt.repeat_end_date ?? null,
    parent_recurring_id: apt.parent_recurring_id ?? null,
    status: apt.status ?? null,
  };
}

export async function fetchAppointmentsFromSupabase(userId: string): Promise<Appointment[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true });
  if (error) return [];
  return (data ?? []).map(rowToAppointment);
}

export async function replaceAppointmentsInSupabase(userId: string, appointments: Appointment[]): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };
  const { error: delErr } = await supabase.from("appointments").delete().eq("user_id", userId);
  if (delErr) return { error: new Error(delErr.message) };
  if (appointments.length === 0) return { error: null };
  const rows = appointments.map((a) => appointmentToRow(a, userId));
  const { error: insertErr } = await supabase.from("appointments").insert(rows);
  return { error: insertErr ? new Error(insertErr.message) : null };
}

export async function deleteAppointmentFromSupabase(userId: string, id: string): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };
  const { error } = await supabase.from("appointments").delete().eq("user_id", userId).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

export async function insertAppointmentsToSupabase(
  userId: string,
  appointments: Appointment[]
): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };
  if (appointments.length === 0) return { error: null };
  const rows = appointments.map((a) => appointmentToRow(a, userId));
  const { error } = await supabase.from("appointments").insert(rows);
  return { error: error ? new Error(error.message) : null };
}

export async function updateAppointmentInSupabase(
  userId: string,
  id: string,
  updates: Partial<Appointment>
): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };
  const payload: Record<string, unknown> = {};
  if (updates.doctor_id !== undefined) payload.doctor_id = updates.doctor_id;
  if (updates.doctorName !== undefined) payload.doctor_name = updates.doctorName;
  if (updates.specialty !== undefined) payload.specialty = updates.specialty;
  if (updates.date !== undefined) payload.date = updates.date;
  if (updates.time !== undefined) payload.time = updates.time;
  if (updates.location !== undefined) payload.location = updates.location;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.status !== undefined) payload.status = updates.status;
  const { error } = await supabase.from("appointments").update(payload).eq("user_id", userId).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}
