// Hebrew calendar facts (which day is Yom Tov, Rosh Chodesh, parsha…) come from @hebcal/core.
// All *times* come from YidCal — see lib/zmanim.ts.
import { HDate, HebrewCalendar, flags, Sedra, Locale } from '@hebcal/core';
import { addDays, fromISODate, weekday } from './time';

const IL = process.env.IN_ISRAEL === 'true';
const NIKUD = /[֑-ׇ]/g;

export const stripNikud = (s: string) => (s || '').replace(NIKUD, '');

export function hd(iso: string): any {
  const [y, m, d] = iso.split('-').map(Number);
  return new HDate(new Date(y, m - 1, d, 12));
}

const isoOfJs = (dt: Date) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

export function isoOfH(h: any): string {
  return isoOfJs(h.greg());
}

export function hebDate(iso: string, withYear = false) {
  const h = hd(iso);
  let s = '';
  try { s = h.renderGematriya(true); } catch { s = h.renderGematriya(); }
  s = stripNikud(s);
  if (!withYear) s = s.replace(/\s+\S+$/, '');
  return s;
}

/** "8 Cheshvan" (English, for speech). */
export function hebDateEn(iso: string) {
  const h = hd(iso);
  let month = '';
  try { month = Locale.gettext(h.getMonthName(), 'ashkenazi') || h.getMonthName(); } catch { month = h.getMonthName(); }
  return `${h.getDate()} ${month}`;
}

export type Ev = { desc: string; title: string; titleHe: string; flags: number };

const yearCache = new Map<number, Map<string, Ev[]>>();

function eventsForGregYear(year: number) {
  if (yearCache.has(year)) return yearCache.get(year)!;
  const map = new Map<string, Ev[]>();
  const evs: any[] = HebrewCalendar.calendar({
    start: new Date(year, 0, 1, 12),
    end: new Date(year, 11, 31, 12),
    il: IL,
    shabbatMevarchim: true,
    noModern: true,
    candlelighting: false,
    sedrot: false,
  } as any);
  for (const ev of evs) {
    const iso = isoOfH(ev.getDate());
    let title = '', titleHe = '';
    try { title = ev.render('ashkenazi'); } catch { title = ev.getDesc(); }
    try { titleHe = stripNikud(ev.render('he')); } catch { titleHe = title; }
    const list = map.get(iso) || [];
    list.push({ desc: ev.getDesc(), title, titleHe, flags: ev.getFlags() });
    map.set(iso, list);
  }
  yearCache.set(year, map);
  return map;
}

export function eventsOn(iso: string): Ev[] {
  const y = Number(iso.slice(0, 4));
  return eventsForGregYear(y).get(iso) || [];
}

const has = (evs: Ev[], f: number) => evs.some((e) => (e.flags & f) !== 0);

// ---------- Behab (Mon–Thu–Mon after the first Shabbos of Cheshvan and Iyar) ----------
const behabCache = new Map<number, string[]>();
function behabForHebYear(hy: number): string[] {
  if (behabCache.has(hy)) return behabCache.get(hy)!;
  const out: string[] = [];
  for (const month of [8 /* Cheshvan */, 2 /* Iyar */]) {
    let iso = isoOfH(new HDate(1, month, hy));
    while (weekday(iso) !== 6) iso = addDays(iso, 1); // first Shabbos on/after the 1st
    out.push(addDays(iso, 2), addDays(iso, 5), addDays(iso, 9)); // Mon, Thu, Mon
  }
  behabCache.set(hy, out);
  return out;
}
export function isBehab(iso: string) {
  const hy = hd(iso).getFullYear();
  return behabForHebYear(hy).includes(iso);
}
export function behabLabel(iso: string) {
  const hy = hd(iso).getFullYear();
  const i = behabForHebYear(hy).indexOf(iso) % 3;
  return ['the first fast of Behab', 'the Thursday fast of Behab', 'the last fast of Behab'][i] || 'a fast of Behab';
}

export type DayInfo = {
  iso: string;
  isShabbos: boolean;
  isYomTov: boolean;
  noMelacha: boolean;
  cholHamoed: boolean;
  fast: boolean;
  behab: boolean;
  roshChodesh: boolean;
  mevorchim: boolean;
  specialShabbos: boolean;
  chanukah: boolean;
  events: Ev[];
};

export function dayInfo(iso: string): DayInfo {
  const evs = eventsOn(iso);
  const isShabbos = weekday(iso) === 6;
  const isYomTov = has(evs, flags.CHAG);
  const behab = isBehab(iso);
  return {
    iso,
    isShabbos,
    isYomTov,
    noMelacha: isShabbos || isYomTov,
    cholHamoed: has(evs, flags.CHOL_HAMOED),
    fast: (has(evs, flags.MINOR_FAST | flags.MAJOR_FAST) && !isYomTov) || behab,
    behab,
    roshChodesh: has(evs, flags.ROSH_CHODESH),
    mevorchim: has(evs, flags.SHABBAT_MEVARCHIM),
    specialShabbos: has(evs, flags.SPECIAL_SHABBAT),
    chanukah: evs.some((e) => (e.flags & flags.CHANUKAH_CANDLES) !== 0 || /^Chanukah/.test(e.desc)),
    events: evs,
  };
}

/** The no-melacha block that starts on/after iso (or contains it). Returns erev + block days. */
export function blockFrom(iso: string) {
  let d = iso;
  let guard = 0;
  while (!dayInfo(d).noMelacha && guard++ < 14) d = addDays(d, 1);
  // walk back if iso was mid-block
  while (dayInfo(addDays(d, -1)).noMelacha) d = addDays(d, -1);
  const days: string[] = [];
  let x = d;
  while (dayInfo(x).noMelacha && days.length < 4) { days.push(x); x = addDays(x, 1); }
  const last = days[days.length - 1];
  return { erev: addDays(d, -1), days, last, endsWithYomTov: dayInfo(last).isYomTov };
}

// ---------- Parsha ----------
const sedraCache = new Map<number, any>();
function sedra(hy: number) {
  if (!sedraCache.has(hy)) sedraCache.set(hy, new Sedra(hy, IL));
  return sedraCache.get(hy);
}

/** Shabbos (Saturday) on/after iso. */
export function shabbosOf(iso: string) {
  let d = iso;
  while (weekday(d) !== 6) d = addDays(d, 1);
  return d;
}

/** Parsha for the week containing iso. { he, en, chag } */
export function parshaOf(iso: string) {
  const shab = shabbosOf(iso);
  const evs = eventsOn(shab);
  try {
    const r = sedra(hd(shab).getFullYear()).lookup(hd(shab));
    if (r && !r.chag && r.parsha?.length) {
      const he = r.parsha.map((p: string) => stripNikud(Locale.gettext(p, 'he') || p)).join('-');
      const en = r.parsha.map((p: string) => Locale.gettext(p, 'ashkenazi') || p).join('-');
      return { he: `פרשת ${he}`, en, chag: false };
    }
  } catch { /* fall through */ }
  const yt = evs.find((e) => (e.flags & flags.CHAG) !== 0) || evs.find((e) => (e.flags & flags.CHOL_HAMOED) !== 0);
  return { he: yt ? yt.titleHe : 'שבת', en: yt ? yt.title : 'Shabbos', chag: true };
}

/** Every week of a Hebrew year: Sunday..Shabbos, labeled by parsha. */
export function weeksOfYear(hy: number) {
  const start = isoOfH(new HDate(1, 7 /* Tishrei */, hy));
  const end = isoOfH(new HDate(1, 7, hy + 1));
  let shab = shabbosOf(start);
  const weeks: { shabbos: string; he: string; en: string; chag: boolean; days: string[] }[] = [];
  while (shab < end) {
    const p = parshaOf(shab);
    const days = Array.from({ length: 7 }, (_, i) => addDays(shab, i - 6));
    weeks.push({ shabbos: shab, ...p, days });
    shab = addDays(shab, 7);
  }
  return weeks;
}

export const currentHebYear = (iso: string) => hd(iso).getFullYear();

export function hebYearLabel(hy: number) {
  try { return stripNikud(new HDate(1, 7, hy).renderGematriya(true)).split(' ').pop(); } catch { return String(hy); }
}

/** Short English title list for a day (for UI notes). */
export function dayNotes(iso: string) {
  const info = dayInfo(iso);
  const notes = info.events
    .filter((e) => !/^Chanukah: \d/.test(e.desc) || true)
    .map((e) => e.titleHe)
    .filter(Boolean);
  if (info.behab) notes.push('תענית בה״ב');
  return Array.from(new Set(notes)).slice(0, 3);
}

export function dayNameHe(iso: string) {
  const wd = weekday(iso) % 7; // Sun=0
  return ['יום א׳', 'יום ב׳', 'יום ג׳', 'יום ד׳', 'יום ה׳', 'יום ו׳', 'שבת'][wd];
}

export { fromISODate };
