import { sql } from '@/lib/db';
import { ok, bad, handle, body } from '@/lib/api';
import { callNow, skipNext, placeRun, refreshNext } from '@/lib/runner';
import { cleanSchedule } from '@/lib/data';
import { nextRun, rowToSchedule } from '@/lib/schedule';
import { now, todayISO } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;
type Ctx = { params: Promise<{ id: string }> };

/** { action: 'now' | 'skip' | 'test' | 'toggle', phone?, schedule? } — id may be "draft" for test calls. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const idStr = (await params).id;
  const b = await body(req);
  if (b.action === 'test') {
    if (!b.phone) return bad('Enter a phone number for the test call');
    let s: any;
    if (b.schedule) s = { ...cleanSchedule(b.schedule), id: idStr === 'draft' ? undefined : Number(idStr) };
    else {
      const r = await sql`select * from schedules where id = ${Number(idStr)}`;
      if (!r[0]) return bad('Schedule not found', 404);
      s = rowToSchedule(r[0]);
    }
    s.name = `${s.name} (test)`;
    const meta = (await nextRun(s, now()).catch(() => null))?.meta || { targetDate: todayISO() };
    const results = await placeRun(s, meta, { name: b.name || 'Test', phone: b.phone });
    return ok({ results });
  }
  const id = Number(idStr);
  if (b.action === 'now') return ok({ results: await callNow(id) });
  if (b.action === 'skip') return ok({ next: await skipNext(id) });
  if (b.action === 'toggle') {
    await sql`update schedules set active = not active, deferred_since = null, updated_at = now() where id = ${id}`;
    await refreshNext(id).catch(() => null);
    return ok({ toggled: id });
  }
  return bad('Unknown action');
});
