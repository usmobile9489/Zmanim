// Zmanim from YidCal's `yidcal.check_zmanim` service (sensor.yidcal_zmanim_lookup),
// cached in Neon so repeated lookups don't hit Home Assistant.
import { DateTime } from 'luxon';
import { sql, json } from './db';
import { callService, getState } from './ha';
import { fromISODate } from './time';

export type ZTime = { iso: string; text: string };
export type DayZ = {
  date: string;
  label?: string;
  z: Record<string, ZTime>;
  candle?: ZTime;
  havdalah?: ZTime;
  motzeiLabel?: string;
};

const norm = (s: string) => (s || '').replace(/[\s"'׳״`]/g, '');

/** Fill-in key → YidCal Hebrew attribute name (normalized). */
export const ZMAN_KEYS: Record<string, { he: string; en: string }> = {
  alos: { he: 'עלות השחר', en: 'Alos HaShachar' },
  talis: { he: 'זמן טלית ותפילין', en: 'Talis & Tefilin' },
  netz: { he: 'הנץ החמה', en: 'Netz' },
  shma_mga: { he: 'סוף זמן קריאת שמע מג״א', en: 'Sof Zman K”S (MGA)' },
  shma_gra: { he: 'סוף זמן קריאת שמע גר״א', en: 'Sof Zman K”S (GRA)' },
  tefilah_mga: { he: 'סוף זמן תפילה מג״א', en: 'Sof Zman Tefilah (MGA)' },
  tefilah_gra: { he: 'סוף זמן תפילה גר״א', en: 'Sof Zman Tefilah (GRA)' },
  chatzos: { he: 'חצות היום', en: 'Chatzos' },
  mincha_gedola: { he: 'מנחה גדולה', en: 'Mincha Gedola' },
  mincha_ketana: { he: 'מנחה קטנה', en: 'Mincha Ketana' },
  plag_gra: { he: 'פלג המנחה גר״א', en: 'Plag (GRA)' },
  plag_mga: { he: 'פלג המנחה מג״א', en: 'Plag (MGA)' },
  shkia: { he: 'שקיעת החמה', en: 'Shkia' },
  tzeis: { he: 'צאת הכוכבים', en: 'Tzeis' },
  maariv_60: { he: 'זמן מעריב 60', en: 'Maariv 60' },
  maariv_rt: { he: 'זמן מעריב ר״ת', en: 'Maariv R”T' },
  chatzos_night: { he: 'חצות הלילה', en: 'Chatzos HaLaila' },
  chometz_eat: { he: 'סוף זמן אכילת חמץ', en: 'Sof Zman Achilas Chometz' },
  chometz_burn: { he: 'סוף זמן שריפת חמץ', en: 'Sof Zman Sriefas Chometz' },
};
const BY_NORM: Record<string, string> = Object.fromEntries(Object.entries(ZMAN_KEYS).map(([k, v]) => [norm(v.he), k]));
const CANDLE = norm('הדלקת נרות');
const MOTZEI_SHABBOS = norm('מוצאי שבת');
const MOTZEI_YT = norm('מוצאי יום טוב');

export function parseTime(v: any, iso: string): ZTime | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const dt = DateTime.fromISO(s, { setZone: true });
    if (dt.isValid) return { iso: dt.toISO()!, text: dt.toFormat('h:mm a') };
  }
  const m = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp]\.?[Mm]\.?)?/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3]?.toLowerCase().replace(/\./g, '');
  if (ap === 'pm') h = (h % 12) + 12;
  else if (ap === 'am') h = h % 12;
  const dt = fromISODate(iso).set({ hour: h, minute: min, second: 0, millisecond: 0 });
  return { iso: dt.toISO()!, text: dt.toFormat('h:mm a') };
}

/** Parse sensor.yidcal_zmanim_lookup attributes into one DayZ per looked-up date. */
export function parseLookup(state: string, attrs: Record<string, any>): Record<string, DayZ> {
  const byIdx: Record<number, Record<string, any>> = {};
  for (const [k, v] of Object.entries(attrs || {})) {
    const m = k.match(/^(.*?)(?:_(\d+))?$/);
    if (!m) continue;
    const idx = m[2] ? parseInt(m[2], 10) : 1;
    (byIdx[idx] ||= {})[m[1]] = v;
  }
  const out: Record<string, DayZ> = {};
  for (const [idxStr, fields] of Object.entries(byIdx)) {
    const idx = Number(idxStr);
    const dateStr = String(fields['Lookup_Date'] || '');
    const iso = dateStr.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (!iso) continue;
    const day: DayZ = { date: iso, z: {}, label: idx === 1 ? state : fields['Label'] };
    for (const [k, v] of Object.entries(fields)) {
      const n = norm(k);
      if (n === CANDLE) { const t = parseTime(v, iso); if (t) day.candle = t; continue; }
      if (n === MOTZEI_SHABBOS || n === MOTZEI_YT) {
        const t = parseTime(v, iso);
        if (t) { day.havdalah = t; day.motzeiLabel = n === MOTZEI_YT ? 'Motzei Yom Tov' : 'Motzei Shabbos'; }
        continue;
      }
      const key = BY_NORM[n];
      if (!key) continue;
      const t = parseTime(v, iso);
      if (!t) continue;
      // Chatzos HaLaila is after midnight when its clock time is in the early morning.
      if (key === 'chatzos_night') {
        const dt = DateTime.fromISO(t.iso, { setZone: true });
        if (dt.hour < 12 && dt.toFormat('yyyy-MM-dd') === iso) t.iso = dt.plus({ days: 1 }).toISO()!;
      }
      day.z[key] = t;
    }
    out[iso] = day;
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const locKey = (loc?: string) => (loc || '').trim().toLowerCase();

async function fetchChunk(dates: string[], location: string) {
  const data: any = { date: dates[0] };
  dates.slice(1).forEach((d, i) => (data[`date_${i + 2}`] = d));
  if (location) data.location = location;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await callService('yidcal', 'check_zmanim', data);
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (/not found|400/i.test(msg)) {
        throw new Error('YidCal’s zmanim lookup service isn’t available. In YidCal options, turn on “Create the Zmanim Lookup sensor and yidcal.check_zmanim service”.');
      }
      throw e;
    }
    for (let poll = 0; poll < 12; poll++) {
      const st = await getState('sensor.yidcal_zmanim_lookup');
      const parsed = parseLookup(st?.state, st?.attributes || {});
      const locOk = !location || !!st?.attributes?.Location;
      if (locOk && dates.every((d) => parsed[d])) return parsed;
      await sleep(400);
    }
  }
  throw new Error('YidCal did not return zmanim for the requested dates.');
}

/** Zmanim for many dates (any count), from cache or YidCal. */
export async function lookupZmanim(dates: string[], location = ''): Promise<Record<string, DayZ>> {
  const uniq = Array.from(new Set(dates.filter(Boolean))).sort();
  if (!uniq.length) return {};
  const loc = locKey(location);
  const out: Record<string, DayZ> = {};
  const rows = await sql`select date::text as date, data from zmanim_cache
    where location = ${loc} and date = any(${uniq}::date[]) and fetched_at > now() - interval '3 days'`;
  for (const r of rows) out[r.date] = r.data;
  const missing = uniq.filter((d) => !out[d]);
  for (let i = 0; i < missing.length; i += 10) {
    const chunk = missing.slice(i, i + 10);
    const parsed = await fetchChunk(chunk, location.trim());
    await Promise.all(
      chunk.map(async (d) => {
        const day = parsed[d];
        if (!day) return;
        out[d] = day;
        await sql`insert into zmanim_cache (location, date, data, fetched_at)
          values (${loc}, ${d}::date, ${json(day)}::jsonb, now())
          on conflict (location, date) do update set data = excluded.data, fetched_at = now()`;
      }),
    );
  }
  return out;
}

export async function clearZmanimCache() {
  await sql`delete from zmanim_cache`;
}
