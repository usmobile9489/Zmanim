import { DateTime } from 'luxon';
import { TZ, addDays, at, fromISODate, isoDate, now, weekday, weekdayName, toDT } from './time';
import { dayInfo, blockFrom, parshaOf, behabLabel, hebDateEn, Ev } from './hebrew';
import { lookupZmanim, ZMAN_KEYS, DayZ } from './zmanim';
import { flags } from '@hebcal/core';

export type Mode = 'event' | 'zman' | 'days' | 'daily';
export type Cfg = {
  time?: string;
  weekdays?: number[]; // luxon: 1=Mon … 7=Sun
  zman?: string;
  offset?: number;
  direction?: 'before' | 'after';
  event?: string;
  daysBefore?: number;
};
export type Schedule = {
  id?: number;
  name: string;
  active: boolean;
  recipients: { contacts: number[]; groups: number[] };
  mode: Mode;
  cfg: Cfg;
  zip: string;
  wording: string;
  repeat: number;
  pause: number;
  press_one: boolean;
  voicemail: boolean;
  retry: boolean;
  skip_melacha: boolean;
  skip_chol_hamoed: boolean;
  skip_fasts: boolean;
  blocked_action: 'skip' | 'defer';
  next_run_at?: any;
  next_meta?: any;
};

export const EVENTS: Record<string, string> = {
  erev_shabbos_yt: 'Erev Shabbos & Erev Yom Tov',
  erev_shabbos: 'Erev Shabbos',
  erev_yt: 'Erev Yom Tov',
  rosh_chodesh: 'Rosh Chodesh',
  behab: 'בה״ב fasts',
  fast: 'Fast days',
  mevorchim: 'Shabbos Mevorchim',
  chanukah: 'Chanukah (each night)',
  special_shabbos: 'Special Shabbos (זכור, פרה…)',
};

export const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function fmtClock(hhmm?: string) {
  if (!hhmm) return '';
  return at('2026-01-01', hhmm).toFormat('h:mm a');
}

function daysText(w?: number[]) {
  const s = [...(w || [])].sort((a, b) => (a % 7) - (b % 7));
  if (!s.length) return 'no days';
  if (s.length === 7) return 'Every day';
  if (s.join() === '7,1,2,3,4') return 'Sun–Thu';
  return s.map((d) => DAY_NAMES[d]).join(', ');
}

export function describe(s: Schedule) {
  const c = s.cfg || {};
  if (s.mode === 'daily') return `Every day · ${fmtClock(c.time)}`;
  if (s.mode === 'days') return `${daysText(c.weekdays)} · ${fmtClock(c.time)}`;
  if (s.mode === 'zman') {
    const z = ZMAN_KEYS[c.zman || '']?.en || ({ candle: 'Candle lighting', havdalah: 'Havdalah' } as any)[c.zman || ''] || c.zman;
    const off = Number(c.offset || 0);
    const rel = off === 0 ? `At ${z}` : `${off} min ${c.direction === 'after' ? 'after' : 'before'} ${z}`;
    return `${daysText(c.weekdays)} · ${rel}`;
  }
  const db = Number(c.daysBefore || 0);
  const ev = EVENTS[c.event || ''] || c.event;
  return `${db === 0 ? 'On' : `${db} day${db > 1 ? 's' : ''} before`} ${ev} · ${fmtClock(c.time)}`;
}

// ---------- Events ----------
function firstRcDay(iso: string) {
  return dayInfo(iso).roshChodesh && !dayInfo(addDays(iso, -1)).roshChodesh;
}

function evTitle(evs: Ev[], f: number) {
  return evs.find((e) => (e.flags & f) !== 0)?.title || '';
}

/** If iso is an occurrence of the event, return its spoken name; else null. */
export function eventOn(key: string, iso: string): string | null {
  const d = dayInfo(iso);
  switch (key) {
    case 'erev_shabbos_yt':
    case 'erev_shabbos':
    case 'erev_yt': {
      if (d.noMelacha || !dayInfo(addDays(iso, 1)).noMelacha) return null;
      const b = blockFrom(addDays(iso, 1));
      const hasShab = b.days.some((x) => dayInfo(x).isShabbos);
      const yt = b.days.map((x) => dayInfo(x)).find((x) => x.isYomTov);
      if (key === 'erev_shabbos' && !hasShab) return null;
      if (key === 'erev_yt' && !yt) return null;
      const ytName = yt ? evTitle(yt.events, flags.CHAG).replace(/ [IV]+$/, '') : '';
      return yt ? (hasShab ? `Shabbos and ${ytName}` : ytName) : 'Shabbos';
    }
    case 'rosh_chodesh':
      return firstRcDay(iso) ? evTitle(d.events, flags.ROSH_CHODESH) || 'Rosh Chodesh' : null;
    case 'behab':
      return d.behab ? behabLabel(iso) : null;
    case 'fast':
      return d.fast && !d.behab ? evTitle(d.events, flags.MINOR_FAST | flags.MAJOR_FAST) || 'a fast day' : null;
    case 'mevorchim':
      return d.mevorchim ? evTitle(d.events, flags.SHABBAT_MEVARCHIM) || 'Shabbos Mevorchim' : null;
    case 'chanukah': {
      const e = d.events.find((x) => (x.flags & flags.CHANUKAH_CANDLES) !== 0);
      return e ? e.title : null;
    }
    case 'special_shabbos':
      return d.specialShabbos ? evTitle(d.events, flags.SPECIAL_SHABBAT) : null;
  }
  return null;
}

// ---------- Next run ----------
export type Run = { at: DateTime; meta: { targetDate: string; eventDate?: string; eventName?: string } };

async function zmanAt(s: Schedule, iso: string, z?: Record<string, DayZ>) {
  const c = s.cfg || {};
  const days = z || (await lookupZmanim([iso], s.zip));
  const t = days[iso]?.z?.[c.zman || ''] || (c.zman === 'candle' ? days[iso]?.candle : c.zman === 'havdalah' ? days[iso]?.havdalah : undefined);
  if (!t) return null;
  const base = DateTime.fromISO(t.iso, { setZone: true }).setZone(TZ);
  const off = Number(c.offset || 0) * (c.direction === 'after' ? 1 : -1);
  return base.plus({ minutes: off });
}

/** Next time this schedule should fire strictly after `after`. */
export async function nextRun(s: Schedule, after: DateTime = now(), horizonDays = 400): Promise<Run | null> {
  const c = s.cfg || {};
  const start = isoDate(after.setZone(TZ).minus({ days: 1 }));
  if (s.mode === 'daily' || s.mode === 'days') {
    for (let i = 0; i < 15; i++) {
      const iso = addDays(start, i);
      if (s.mode === 'days' && !(c.weekdays || []).includes(weekday(iso))) continue;
      const dt = at(iso, c.time || '09:00');
      if (dt > after) return { at: dt, meta: { targetDate: iso } };
    }
    return null;
  }
  if (s.mode === 'zman') {
    const wds = c.weekdays?.length ? c.weekdays : [1, 2, 3, 4, 5, 6, 7];
    // Zmanim that need a lighting/havdalah only exist on some days; look a bit further.
    const span = ['candle', 'havdalah'].includes(c.zman || '') ? 30 : 10;
    const cands: string[] = [];
    for (let i = 0; i < span; i++) {
      const iso = addDays(start, i);
      if (wds.includes(weekday(iso))) cands.push(iso);
    }
    const z = await lookupZmanim(cands, s.zip);
    for (const iso of cands) {
      const dt = await zmanAt(s, iso, z);
      if (dt && dt > after) return { at: dt, meta: { targetDate: iso } };
    }
    return null;
  }
  // event
  const db = Number(c.daysBefore || 0);
  for (let i = 0; i < horizonDays; i++) {
    const evIso = addDays(start, i);
    const name = eventOn(c.event || '', evIso);
    if (!name) continue;
    const fireIso = addDays(evIso, -db);
    const dt = at(fireIso, c.time || '10:00');
    if (dt > after) return { at: dt, meta: { targetDate: evIso, eventDate: evIso, eventName: name } };
  }
  return null;
}

/** All fire times between from and to (for the week view). */
export async function projectRuns(s: Schedule, from: DateTime, to: DateTime, max = 20) {
  const out: Run[] = [];
  let cursor = from.minus({ seconds: 1 });
  for (let i = 0; i < max; i++) {
    const r = await nextRun(s, cursor, 30);
    if (!r || r.at > to) break;
    out.push(r);
    cursor = r.at;
  }
  return out;
}

// ---------- Message ----------
export const FILL_INS = [
  'candle_lighting', 'havdalah', 'motzei_label', 'lighting_schedule', 'event_name', 'event_day', 'event_date',
  'parsha', 'hebrew_date', 'name', 'first_name', 'weekday', ...Object.keys(ZMAN_KEYS),
];

const night = (iso: string) => `${weekdayName(iso)} night`;

/** Builds every fill-in value for a run (person-independent). */
export async function buildVars(s: Schedule, meta: Run['meta']) {
  const target = meta.targetDate;
  const block = blockFrom(target);
  const dates = [target, block.erev, ...block.days];
  const z = await lookupZmanim(dates, s.zip);
  const vars: Record<string, string> = {};
  const tz = z[target];
  for (const k of Object.keys(ZMAN_KEYS)) if (tz?.z?.[k]) vars[k] = tz.z[k].text;

  // Candle lighting / havdalah / lighting schedule for the coming Shabbos or Yom Tov block.
  const erevZ = z[block.erev];
  const candle = erevZ?.candle;
  let hav = undefined as any, motzei = '';
  for (const d of [block.last, ...block.days, block.erev]) {
    if (z[d]?.havdalah) { hav = z[d].havdalah; motzei = z[d].motzeiLabel || ''; break; }
  }
  if (!motzei) motzei = block.endsWithYomTov ? 'Motzei Yom Tov' : 'Motzei Shabbos';
  if (candle) vars.candle_lighting = candle.text;
  if (hav) vars.havdalah = hav.text;
  vars.motzei_label = motzei;
  const parts: string[] = [];
  if (candle) parts.push(`Candle lighting ${weekdayName(block.erev)} at ${candle.text}.`);
  for (let k = 1; k < block.days.length; k++) {
    const prev = block.days[k - 1];
    const pz = z[prev];
    if (pz?.candle) parts.push(`${weekdayName(prev)}, light by ${pz.candle.text}.`);
    else if (pz?.z?.tzeis) parts.push(`${night(prev)}, light after ${pz.z.tzeis.text}.`);
  }
  if (hav) parts.push(block.days.length > 1 ? `${motzei} is ${night(block.last)} at ${hav.text}.` : `${motzei} is at ${hav.text}.`);
  vars.lighting_schedule = parts.join(' ');

  const p = parshaOf(target);
  vars.parsha = p.chag ? p.en : `Parshas ${p.en}`;
  vars.hebrew_date = hebDateEn(target);
  vars.weekday = weekdayName(target);
  vars.event_name = meta.eventName || '';
  vars.event_day = meta.eventDate ? weekdayName(meta.eventDate) : '';
  vars.event_date = meta.eventDate ? fromISODate(meta.eventDate).toFormat('MMMM d') : '';
  return vars;
}

export function render(wording: string, vars: Record<string, string>, person?: { name?: string }) {
  const all = { ...vars, name: person?.name || '', first_name: (person?.name || '').split(' ')[0] || '' };
  const missing: string[] = [];
  const text = (wording || '').replace(/\{(\w+)\}/g, (_, k) => {
    const v = all[k];
    if (v === undefined || v === '') { missing.push(k); return ''; }
    return v;
  });
  return { text: text.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim(), missing };
}

export function rowToSchedule(r: any): Schedule {
  return {
    ...r,
    recipients: r.recipients || { contacts: [], groups: [] },
    cfg: r.cfg || {},
  };
}

export { toDT };
