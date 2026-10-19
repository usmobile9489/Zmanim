'use client';
import { useEffect } from 'react';

export async function api(path: string, opts: { method?: string; body?: any } = {}) {
  const r = await fetch(path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json' },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { window.location.href = '/login'; throw new Error('Not signed in'); }
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`panel${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
          <h2>{title}</h2>
          <button type="button" className="btn g" aria-label="Close" style={{ minWidth: 44, padding: 0 }} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PhoneIcon({ color = '#7CC4F2' }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

export const STATUS_PILL: Record<string, [string, string]> = {
  answered: ['p-ok', 'Answered'],
  voicemail: ['p-warn', 'Voicemail'],
  'no-answer': ['p-bad', 'No answer'],
  busy: ['p-bad', 'Busy'],
  failed: ['p-bad', 'Failed'],
  skipped: ['p-off', 'Skipped'],
  deferred: ['p-warn', 'Waiting'],
  queued: ['p-info', 'Queued'],
  calling: ['p-info', 'Calling…'],
  ringing: ['p-info', 'Ringing'],
  retry_pending: ['p-info', 'Will retry'],
  'machine-hangup': ['p-off', 'Machine · hung up'],
};

export function StatusPill({ status }: { status: string }) {
  const [cls, label] = STATUS_PILL[status] || ['p-off', status];
  return <span className={`pill ${cls}`}>{label}</span>;
}

export function fmtWhen(v: any) {
  if (!v) return '';
  const d = new Date(v);
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const ZMAN_OPTIONS: [string, string][] = [
  ['alos', 'Alos HaShachar'], ['talis', 'Talis & Tefilin'], ['netz', 'Netz'],
  ['shma_mga', 'Sof Zman K”S (MGA)'], ['shma_gra', 'Sof Zman K”S (GRA)'],
  ['tefilah_mga', 'Sof Zman Tefilah (MGA)'], ['tefilah_gra', 'Sof Zman Tefilah (GRA)'],
  ['chatzos', 'Chatzos'], ['mincha_gedola', 'Mincha Gedola'], ['mincha_ketana', 'Mincha Ketana'],
  ['plag_gra', 'Plag (GRA)'], ['plag_mga', 'Plag (MGA)'], ['shkia', 'Shkia'], ['tzeis', 'Tzeis'],
  ['maariv_60', 'Maariv 60'], ['maariv_rt', 'Maariv R”T'], ['chatzos_night', 'Chatzos HaLaila'],
  ['candle', 'Candle lighting'], ['havdalah', 'Havdalah'],
];

export const LUACH_COLUMNS: [string, string][] = [
  ['alos', 'עלות השחר'], ['talis', 'טלית ותפילין'], ['netz', 'הנץ החמה'],
  ['shma_mga', 'ק״ש מג״א'], ['shma_gra', 'ק״ש גר״א'], ['tefilah_mga', 'תפילה מג״א'], ['tefilah_gra', 'תפילה גר״א'],
  ['chatzos', 'חצות'], ['mincha_gedola', 'מנחה גדולה'], ['mincha_ketana', 'מנחה קטנה'],
  ['plag_gra', 'פלג גר״א'], ['plag_mga', 'פלג מג״א'], ['shkia', 'שקיעה'], ['tzeis', 'צאת הכוכבים'],
  ['maariv_60', 'מעריב 60'], ['maariv_rt', 'מעריב ר״ת'], ['chatzos_night', 'חצות הלילה'],
  ['candle', 'הדלקת נרות'], ['havdalah', 'מוצאי שבת/יו״ט'],
];

export const EVENT_OPTIONS: [string, string][] = [
  ['erev_shabbos_yt', 'Erev Shabbos & Erev Yom Tov'],
  ['erev_shabbos', 'Erev Shabbos'],
  ['erev_yt', 'Erev Yom Tov'],
  ['rosh_chodesh', 'Rosh Chodesh'],
  ['behab', 'בה״ב fasts'],
  ['fast', 'Other fast days'],
  ['mevorchim', 'Shabbos Mevorchim'],
  ['chanukah', 'Chanukah (each night)'],
  ['special_shabbos', 'Special Shabbos (זכור, פרה…)'],
];

export const FILLINS = [
  'candle_lighting', 'havdalah', 'motzei_label', 'lighting_schedule', 'maariv_60', 'maariv_rt', 'shma_mga', 'shma_gra',
  'tefilah_mga', 'alos', 'netz', 'chatzos', 'mincha_gedola', 'plag_gra', 'shkia', 'tzeis',
  'event_name', 'event_day', 'event_date', 'parsha', 'hebrew_date', 'weekday', 'first_name', 'name',
];

export const TEMPLATES: [string, string][] = [
  ['Shabbos / Yom Tov times', 'Hello, this is a reminder. {lighting_schedule} Good Shabbos.'],
  ['Zman Maariv', 'Zman Maariv tonight is at {maariv_60}.'],
  ['Krias Shma', 'Sof zman Krias Shma today is at {shma_mga}.'],
  ['Rosh Chodesh', 'Tomorrow is {event_name}. Don’t forget Yaaleh V’yavo.'],
  ['בה״ב fast', 'Tomorrow, {event_day}, is {event_name}. The fast begins at {alos}.'],
  ['Fast day', '{event_name} is on {event_day}. The fast begins at {alos} and ends at {tzeis}.'],
];

// luxon weekday numbers in Sun..Sat order
export const WEEKDAYS: [number, string][] = [[7, 'Sun'], [1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat']];
