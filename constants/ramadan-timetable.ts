export interface RamadanDay {
  hijriDay: number;
  date: string;
  fajr: string;
  maghrib: string;
}

const RAMADAN_2026: RamadanDay[] = [
  { hijriDay: 1,  date: "2026-02-18", fajr: "05:19", maghrib: "05:20" },
  { hijriDay: 2,  date: "2026-02-19", fajr: "05:17", maghrib: "05:21" },
  { hijriDay: 3,  date: "2026-02-20", fajr: "05:16", maghrib: "05:22" },
  { hijriDay: 4,  date: "2026-02-21", fajr: "05:14", maghrib: "05:23" },
  { hijriDay: 5,  date: "2026-02-22", fajr: "05:13", maghrib: "05:25" },
  { hijriDay: 6,  date: "2026-02-23", fajr: "05:12", maghrib: "05:26" },
  { hijriDay: 7,  date: "2026-02-24", fajr: "05:10", maghrib: "05:27" },
  { hijriDay: 8,  date: "2026-02-25", fajr: "05:09", maghrib: "05:28" },
  { hijriDay: 9,  date: "2026-02-26", fajr: "05:07", maghrib: "05:30" },
  { hijriDay: 10, date: "2026-02-27", fajr: "05:06", maghrib: "05:31" },
  { hijriDay: 11, date: "2026-02-28", fajr: "05:04", maghrib: "05:32" },
  { hijriDay: 12, date: "2026-03-01", fajr: "05:02", maghrib: "05:33" },
  { hijriDay: 13, date: "2026-03-02", fajr: "05:01", maghrib: "05:35" },
  { hijriDay: 14, date: "2026-03-03", fajr: "04:59", maghrib: "05:36" },
  { hijriDay: 15, date: "2026-03-04", fajr: "04:58", maghrib: "05:37" },
  { hijriDay: 16, date: "2026-03-05", fajr: "04:56", maghrib: "05:38" },
  { hijriDay: 17, date: "2026-03-06", fajr: "04:54", maghrib: "05:39" },
  { hijriDay: 18, date: "2026-03-07", fajr: "04:53", maghrib: "05:41" },
  { hijriDay: 19, date: "2026-03-08", fajr: "04:51", maghrib: "05:42" },
  { hijriDay: 20, date: "2026-03-09", fajr: "04:49", maghrib: "05:43" },
  { hijriDay: 21, date: "2026-03-10", fajr: "04:48", maghrib: "05:44" },
  { hijriDay: 22, date: "2026-03-11", fajr: "04:46", maghrib: "05:45" },
  { hijriDay: 23, date: "2026-03-12", fajr: "04:44", maghrib: "05:46" },
  { hijriDay: 24, date: "2026-03-13", fajr: "04:42", maghrib: "05:48" },
  { hijriDay: 25, date: "2026-03-14", fajr: "04:41", maghrib: "05:49" },
  { hijriDay: 26, date: "2026-03-15", fajr: "04:39", maghrib: "05:50" },
  { hijriDay: 27, date: "2026-03-16", fajr: "04:37", maghrib: "05:51" },
  { hijriDay: 28, date: "2026-03-17", fajr: "04:35", maghrib: "05:52" },
  { hijriDay: 29, date: "2026-03-18", fajr: "04:34", maghrib: "05:53" },
  { hijriDay: 30, date: "2026-03-19", fajr: "04:32", maghrib: "05:55" },
];

export function getTodayRamadan(dateStr: string): RamadanDay | undefined {
  return RAMADAN_2026.find(d => d.date === dateStr);
}

export function getRamadanDayNumber(dateStr: string): number | undefined {
  const day = RAMADAN_2026.find(d => d.date === dateStr);
  return day?.hijriDay;
}

export default RAMADAN_2026;
