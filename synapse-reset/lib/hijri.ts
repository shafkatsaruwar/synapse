/**
 * Check if the current Gregorian date falls in the Islamic month of Ramadan (month 9).
 * Uses hijri-converter (Umm al-Qura) for conversion.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const hijriConverter = require("hijri-converter") as {
  toHijri: (gy: number, gm: number, gd: number) => { hy: number; hm: number; hd: number };
};

const RAMADAN_MONTH = 9;

export function isCurrentMonthRamadan(): boolean {
  const now = new Date();
  const gy = now.getFullYear();
  const gm = now.getMonth() + 1; // 1-based
  const gd = now.getDate();
  const h = hijriConverter.toHijri(gy, gm, gd);
  return h.hm === RAMADAN_MONTH;
}
