import assert from "node:assert/strict";
import { detectAppointmentOverlaps } from "./appointment-overlap";
import type { Appointment } from "./storage";

function apt(partial: Partial<Appointment> & { id: string; doctorName: string; date: string; time: string }): Appointment {
  return partial as Appointment;
}

{
  console.log("1. Close starts without endTime → gentle hint");
  const hints = detectAppointmentOverlaps([
    apt({ id: "a", doctorName: "Dr A", date: "2026-10-21", time: "10:00" }),
    apt({ id: "b", doctorName: "Dr B", date: "2026-10-21", time: "10:10" }),
  ]);
  assert.equal(hints.size, 2);
  assert.equal(hints.get("a")?.intervalsOverlap, false);
  assert.ok((hints.get("a")?.gapMinutes ?? 99) <= 15);
  assert.ok(hints.get("a")?.message.includes("Dr B"));
}

{
  console.log("2. Known overlapping intervals");
  const hints = detectAppointmentOverlaps([
    apt({ id: "a", doctorName: "Dr A", date: "2026-10-21", time: "10:00", endTime: "11:00" }),
    apt({ id: "b", doctorName: "Dr B", date: "2026-10-21", time: "10:30", endTime: "11:30" }),
  ]);
  assert.equal(hints.get("a")?.intervalsOverlap, true);
  assert.ok(hints.get("a")?.message.toLowerCase().includes("overlap"));
}

{
  console.log("3. Far apart starts ignored");
  const hints = detectAppointmentOverlaps([
    apt({ id: "a", doctorName: "Dr A", date: "2026-10-21", time: "09:00" }),
    apt({ id: "b", doctorName: "Dr B", date: "2026-10-21", time: "14:00" }),
  ]);
  assert.equal(hints.size, 0);
}

{
  console.log("4. Cancelled appointments ignored");
  const hints = detectAppointmentOverlaps([
    apt({ id: "a", doctorName: "Dr A", date: "2026-10-21", time: "10:00" }),
    apt({ id: "b", doctorName: "Dr B", date: "2026-10-21", time: "10:05", status: "cancelled" }),
  ]);
  assert.equal(hints.size, 0);
}

{
  console.log("5. Different days ignored");
  const hints = detectAppointmentOverlaps([
    apt({ id: "a", doctorName: "Dr A", date: "2026-10-21", time: "10:00" }),
    apt({ id: "b", doctorName: "Dr B", date: "2026-10-22", time: "10:05" }),
  ]);
  assert.equal(hints.size, 0);
}

console.log("appointment-overlap: all assertions passed");
