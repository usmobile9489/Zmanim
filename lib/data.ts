// Shared reads + input cleaning for the API routes.
import { sql } from './db';
import { Schedule, describe, rowToSchedule, EVENTS } from './schedule';
import { toDT, now } from './time';

export function cleanSchedule(b: any): Schedule {
  const mode = ['event', 'zman', 'days', 'daily'].includes(b?.mode) ? b.mode : 'event';
  const c = b?.cfg || {};
  const time = /^\d{1,2}:\d{2}$/.test(c.time || '') ? c.time : '10:00';
  const cfg: any = { time };
  if (mode === 'days' || mode === 'zman') {
    cfg.weekdays = (Array.isArray(c.weekdays) ? c.weekdays : []).map(Number).filter((n: number) => n >= 1 && n <= 7);
  }
  if (mode === 'zman') {
    cfg.zman = String(c.zman || 'maariv_60');
    cfg.offset = Math.max(0, Math.min(600, Number(c.offset) || 0));
    cfg.direction = c.direction === 'after' ? 'after' : 'before';
    delete cfg.time;
  }
  if (mode === 'event') {
    cfg.event = EVENTS[c.event] ? c.event : 'erev_shabbos_yt';
    cfg.daysBefore = Math.max(0, Math.min(14, Number(c.daysBefore) || 0));
  }
  const ids = (a: any) => (Array.isArray(a) ? a.map(Number).filter((n) => n > 0) : []);
  return {
    name: String(b?.name || 'Untitled schedule').slice(0, 120),
    active: b?.active !== false,
    recipients: { contacts: ids(b?.recipients?.contacts), groups: ids(b?.recipients?.groups) },
    mode,
    cfg,
    zip: String(b?.zip || '').trim().slice(0, 60),
    wording: String(b?.wording || '').slice(0, 1500),
    repeat: Math.max(1, Math.min(5, Number(b?.repeat) || 1)),
    pause: Math.max(0, Math.min(10, Number(b?.pause ?? 2))),
    press_one: !!b?.press_one,
    voicemail: b?.voicemail !== false,
    retry: !!b?.retry,
    skip_melacha: b?.skip_melacha !== false,
    skip_chol_hamoed: !!b?.skip_chol_hamoed,
    skip_fasts: !!b?.skip_fasts,
    blocked_action: b?.blocked_action === 'defer' ? 'defer' : 'skip',
  };
}

export async function loadPeople() {
  const contacts = await sql`select c.id, c.name, c.phone, c.zip,
      coalesce(array_agg(gm.group_id) filter (where gm.group_id is not null), '{}') as groups
    from contacts c left join group_members gm on gm.contact_id = c.id
    group by c.id order by c.name`;
  const groups = await sql`select g.id, g.name,
      coalesce(array_agg(gm.contact_id) filter (where gm.contact_id is not null), '{}') as members
    from groups g left join group_members gm on gm.group_id = g.id
    group by g.id order by g.name`;
  return { contacts, groups };
}

export function whoText(s: Schedule, people: { contacts: any[]; groups: any[] }) {
  const parts: string[] = [];
  for (const gid of s.recipients.groups || []) {
    const g = people.groups.find((x: any) => x.id === gid);
    if (g) parts.push(`${g.name} · ${g.members.length}`);
  }
  for (const cid of s.recipients.contacts || []) {
    const c = people.contacts.find((x: any) => x.id === cid);
    if (c) parts.push(c.name);
  }
  return parts.join(', ') || 'No one yet';
}

export function nextText(v: any) {
  if (!v) return '';
  const dt = toDT(v);
  const today = now().startOf('day');
  const d = dt.startOf('day').diff(today, 'days').days;
  const time = dt.toFormat('h:mm a');
  if (d === 0) return `Today ${time}`;
  if (d === 1) return `Tomorrow ${time}`;
  if (d > 1 && d < 7) return `${dt.toFormat('ccc')} ${time}`;
  return `${dt.toFormat('ccc, MMM d')} · ${time}`;
}

export async function loadSchedules(people?: any) {
  const p = people || (await loadPeople());
  const rows = await sql`select * from schedules order by active desc, next_run_at nulls last, id`;
  return rows.map((r: any) => {
    const s = rowToSchedule(r);
    return {
      ...s,
      when: describe(s),
      who: whoText(s, p),
      next: s.active ? nextText(r.next_run_at) || (r.last_error ? '—' : 'Planning…') : 'Paused',
      next_run_at: r.next_run_at,
      last_error: r.last_error,
      last_run_at: r.last_run_at,
    };
  });
}

export async function setGroups(contactId: number, groups: any) {
  const ids = (Array.isArray(groups) ? groups : []).map(Number).filter((n: number) => n > 0);
  await sql`delete from group_members where contact_id = ${contactId}`;
  for (const g of ids) await sql`insert into group_members (group_id, contact_id) values (${g}, ${contactId}) on conflict do nothing`;
}

export async function setMembers(groupId: number, members: any) {
  const ids = (Array.isArray(members) ? members : []).map(Number).filter((n: number) => n > 0);
  await sql`delete from group_members where group_id = ${groupId}`;
  for (const c of ids) await sql`insert into group_members (group_id, contact_id) values (${groupId}, ${c}) on conflict do nothing`;
}
