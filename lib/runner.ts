import { DateTime } from 'luxon';
import { sql } from './db';
import { now, todayISO, toDT } from './time';
import { dayInfo } from './hebrew';
import { getState, haConfigured } from './ha';
import { Schedule, nextRun, buildVars, render, rowToSchedule } from './schedule';
import { placeCall } from './twilio';

export type Person = { id: number | null; name: string; phone: string };

export async function recipientsOf(s: Schedule): Promise<Person[]> {
  const cids = (s.recipients?.contacts || []).map(Number);
  const gids = (s.recipients?.groups || []).map(Number);
  const rows = await sql`select distinct c.id, c.name, c.phone from contacts c
    left join group_members gm on gm.contact_id = c.id
    where c.id = any(${cids}::int[]) or gm.group_id = any(${gids}::int[])
    order by c.name`;
  return rows.map((r: any) => ({ id: r.id, name: r.name, phone: r.phone }));
}

/** Is calling blocked right now for this schedule? */
export async function blockedNow(s: Schedule): Promise<{ blocked: boolean; reason?: string; error?: string }> {
  const today = dayInfo(todayISO());
  if (s.skip_chol_hamoed && today.cholHamoed) return { blocked: true, reason: 'Chol Hamoed' };
  if (s.skip_fasts && today.fast) return { blocked: true, reason: 'Fast day' };
  if (s.skip_melacha) {
    if (!haConfigured()) return { blocked: true, error: 'Home Assistant not configured, so issur melacha can’t be checked' };
    try {
      const st = await getState('binary_sensor.yidcal_no_melucha');
      if (st?.state === 'on') return { blocked: true, reason: 'Shabbos / Yom Tov' };
    } catch (e: any) {
      return { blocked: true, error: `Couldn’t check issur melacha: ${e?.message || e}` };
    }
  }
  return { blocked: false };
}

async function logRow(s: Schedule, fields: Record<string, any>) {
  const r = await sql`insert into call_log
    (schedule_id, schedule_name, contact_id, contact_name, phone, status, reason, message, repeat, pause, press_one, voicemail, retry, attempt, scheduled_for)
    values (${s.id ?? null}, ${s.name}, ${fields.contact_id ?? null}, ${fields.contact_name ?? null}, ${fields.phone ?? null},
      ${fields.status}, ${fields.reason ?? null}, ${fields.message ?? null}, ${s.repeat || 1}, ${s.pause || 2},
      ${!!s.press_one}, ${s.voicemail !== false}, ${!!s.retry}, ${fields.attempt ?? 1}, ${fields.scheduled_for ?? new Date().toISOString()})
    returning id`;
  return r[0].id as number;
}

async function dialRow(id: number, phone: string, voicemail: boolean) {
  try {
    const sid = await placeCall({ to: phone, callLogId: id, voicemail });
    await sql`update call_log set status = 'calling', twilio_sid = ${sid}, updated_at = now() where id = ${id}`;
    return { ok: true };
  } catch (e: any) {
    await sql`update call_log set status = 'failed', reason = ${String(e?.message || e).slice(0, 300)}, updated_at = now() where id = ${id}`;
    return { ok: false, error: e?.message || String(e) };
  }
}

/** Render and place the calls for one run. */
export async function placeRun(s: Schedule, meta: any, onlyPhone?: { name: string; phone: string }) {
  const vars = await buildVars(s, meta);
  const people: Person[] = onlyPhone ? [{ id: null, ...onlyPhone }] : await recipientsOf(s);
  if (!people.length) throw new Error('No people in this schedule');
  const results = [];
  for (const p of people) {
    const { text } = render(s.wording, vars, p);
    const id = await logRow(s, { contact_id: p.id, contact_name: p.name, phone: p.phone, status: 'queued', message: text });
    results.push({ name: p.name, ...(await dialRow(id, p.phone, s.voicemail !== false)) });
  }
  return results;
}

async function saveNext(id: number, from: DateTime, s: Schedule, extra: { lastRun?: boolean } = {}) {
  let next: any = null, err: string | null = null;
  try { next = await nextRun(s, from); } catch (e: any) { err = e?.message || String(e); }
  if (!next && !err) err = 'No upcoming time found for this schedule';
  await sql`update schedules set
      next_run_at = ${next ? next.at.toISO() : null},
      next_meta = ${next ? JSON.stringify(next.meta) : null}::jsonb,
      last_run_at = case when ${!!extra.lastRun} then now() else last_run_at end,
      deferred_since = null, locked_until = null, last_error = ${err}, updated_at = now()
    where id = ${id}`;
  return next;
}

export async function refreshNext(id: number) {
  const r = await sql`select * from schedules where id = ${id}`;
  if (!r[0]) return null;
  const s = rowToSchedule(r[0]);
  if (!s.active) {
    await sql`update schedules set next_run_at = null, next_meta = null, last_error = null where id = ${id}`;
    return null;
  }
  return saveNext(id, now(), s);
}

async function runDue(row: any) {
  const s = rowToSchedule(row);
  const due = toDT(row.next_run_at);
  const late = now().diff(due, 'minutes').minutes;
  const claimed = await sql`update schedules set locked_until = now() + interval '4 minutes'
    where id = ${s.id} and next_run_at = ${row.next_run_at} and (locked_until is null or locked_until < now())
    returning id`;
  if (!claimed.length) return { id: s.id, status: 'locked' };

  // Too stale (pinger was down)? Skip instead of calling hours late.
  if (late > 90) {
    await logRow(s, { status: 'skipped', reason: `Missed — was due ${due.toFormat('ccc h:mm a')}`, contact_name: 'Everyone' });
    await saveNext(s.id!, now(), s);
    return { id: s.id, status: 'missed' };
  }

  const b = await blockedNow(s);
  if (b.blocked) {
    const giveUp = row.deferred_since && now().diff(toDT(row.deferred_since), 'hours').hours > 48;
    if (b.error && late < 60) {
      // Can't verify — wait and retry each minute for up to an hour.
      await sql`update schedules set locked_until = null, last_error = ${b.error} where id = ${s.id}`;
      return { id: s.id, status: 'waiting', reason: b.error };
    }
    if (s.blocked_action === 'defer' && !b.error && !giveUp) {
      if (!row.deferred_since) {
        await logRow(s, { status: 'deferred', reason: `${b.reason} — will call when it ends`, contact_name: 'Everyone' });
        await sql`update schedules set deferred_since = now() where id = ${s.id}`;
      }
      await sql`update schedules set locked_until = null where id = ${s.id}`;
      return { id: s.id, status: 'deferred' };
    }
    await logRow(s, { status: b.error ? 'failed' : 'skipped', reason: b.error || b.reason, contact_name: 'Everyone' });
    await saveNext(s.id!, now(), s);
    return { id: s.id, status: 'skipped', reason: b.reason || b.error };
  }

  try {
    const results = await placeRun(s, row.next_meta || { targetDate: due.toFormat('yyyy-MM-dd') });
    await saveNext(s.id!, now(), s, { lastRun: true });
    return { id: s.id, status: 'called', results };
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (late < 60) {
      await sql`update schedules set locked_until = null, last_error = ${msg} where id = ${s.id}`;
      return { id: s.id, status: 'retrying', reason: msg };
    }
    await logRow(s, { status: 'failed', reason: msg, contact_name: 'Everyone' });
    await saveNext(s.id!, now(), s);
    return { id: s.id, status: 'failed', reason: msg };
  }
}

/** Called every minute by the outside pinger. */
export async function tick() {
  const out: any = { at: now().toISO(), runs: [], retries: 0, planned: 0 };

  // Plan schedules that have no next run yet.
  const unplanned = await sql`select id from schedules where active and next_run_at is null
    and (updated_at < now() - interval '20 minutes' or last_error is null) limit 10`;
  for (const r of unplanned) { await refreshNext(r.id); out.planned++; }

  const due = await sql`select * from schedules where active and next_run_at is not null and next_run_at <= now()
    order by next_run_at limit 10`;
  for (const row of due) out.runs.push(await runDue(row));

  // "Try once more" retries.
  const retries = await sql`update call_log set status = 'queued', updated_at = now()
    where id in (select id from call_log where status = 'retry_pending' and scheduled_for <= now() limit 20)
    returning id, phone, voicemail`;
  for (const r of retries) { await dialRow(r.id, r.phone, r.voicemail); out.retries++; }
  return out;
}

/** Manual "Call now" for the upcoming run (keeps the schedule's timing). */
export async function callNow(id: number) {
  const r = await sql`select * from schedules where id = ${id}`;
  if (!r[0]) throw new Error('Schedule not found');
  const s = rowToSchedule(r[0]);
  const meta = r[0].next_meta || (await nextRun(s, now()))?.meta || { targetDate: todayISO() };
  return placeRun(s, meta);
}

export async function skipNext(id: number) {
  const r = await sql`select * from schedules where id = ${id}`;
  if (!r[0]) throw new Error('Schedule not found');
  const s = rowToSchedule(r[0]);
  const from = r[0].next_run_at ? toDT(r[0].next_run_at).plus({ minutes: 1 }) : now();
  await logRow(s, { status: 'skipped', reason: 'Skipped by you', contact_name: 'Everyone', scheduled_for: r[0].next_run_at });
  return saveNext(id, from, s);
}

/** Twilio status callback → update the log (and queue a retry if asked). */
export async function applyStatus(id: number, p: Record<string, string>) {
  const st = p.CallStatus;
  const answeredBy = p.AnsweredBy || null;
  let status = st;
  if (st === 'in-progress') status = 'calling';
  if (st === 'completed') status = answeredBy && answeredBy.startsWith('machine') ? 'voicemail' : 'answered';
  if (st === 'canceled') status = 'failed';
  const dur = p.CallDuration ? parseInt(p.CallDuration, 10) : null;
  const rows = await sql`update call_log set status = case when status = 'machine-hangup' then status else ${status} end,
      duration = coalesce(${dur}, duration), answered_by = coalesce(${answeredBy}, answered_by), updated_at = now()
    where id = ${id} returning *`;
  const row = rows[0];
  if (row && row.retry && row.attempt === 1 && ['no-answer', 'busy', 'failed'].includes(status)) {
    await sql`insert into call_log (schedule_id, schedule_name, contact_id, contact_name, phone, status, reason, message,
        repeat, pause, press_one, voicemail, retry, attempt, scheduled_for)
      values (${row.schedule_id}, ${row.schedule_name}, ${row.contact_id}, ${row.contact_name}, ${row.phone}, 'retry_pending',
        'Trying once more', ${row.message}, ${row.repeat}, ${row.pause}, ${row.press_one}, ${row.voicemail}, false, 2,
        now() + interval '10 minutes')`;
  }
}
