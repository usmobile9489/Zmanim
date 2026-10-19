import { DateTime } from 'luxon';

export const TZ = process.env.APP_TZ || 'America/New_York';

export const now = () => DateTime.now().setZone(TZ);

/** 'yyyy-MM-dd' for a luxon DateTime (in its own zone). */
export const isoDate = (dt: DateTime) => dt.toFormat('yyyy-MM-dd');

export const fromISODate = (iso: string) => DateTime.fromISO(iso, { zone: TZ }).startOf('day');

export const addDays = (iso: string, n: number) => isoDate(fromISODate(iso).plus({ days: n }));

/** Local date + 'HH:mm' → DateTime in app zone. */
export function at(iso: string, hhmm: string) {
  const [h, m] = (hhmm || '00:00').split(':').map((x) => parseInt(x, 10) || 0);
  return fromISODate(iso).set({ hour: h, minute: m, second: 0, millisecond: 0 });
}

/** Spoken/display time, e.g. "5:50 PM". */
export const fmtTime = (dt: DateTime) => dt.toFormat('h:mm a');

export const weekdayName = (iso: string) => fromISODate(iso).toFormat('cccc');

/** luxon weekday: 1=Mon … 7=Sun. Saturday = 6. */
export const weekday = (iso: string) => fromISODate(iso).weekday;

/** Sunday that starts the week containing iso. */
export function weekStart(iso: string) {
  const wd = weekday(iso) % 7; // Sun=0
  return addDays(iso, -wd);
}

export const todayISO = () => isoDate(now());

export const toDT = (v: any) =>
  v instanceof Date ? DateTime.fromJSDate(v).setZone(TZ) : DateTime.fromISO(String(v)).setZone(TZ);
