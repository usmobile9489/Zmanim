import { sql, json } from '@/lib/db';
import { ok, handle, body } from '@/lib/api';
import { cleanSchedule } from '@/lib/data';
import { refreshNext } from '@/lib/runner';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const id = Number((await params).id);
  const s = cleanSchedule(await body(req));
  await sql`update schedules set name = ${s.name}, active = ${s.active}, recipients = ${json(s.recipients)}::jsonb,
      mode = ${s.mode}, cfg = ${json(s.cfg)}::jsonb, zip = ${s.zip}, wording = ${s.wording}, repeat = ${s.repeat},
      pause = ${s.pause}, press_one = ${s.press_one}, voicemail = ${s.voicemail}, retry = ${s.retry},
      skip_melacha = ${s.skip_melacha}, skip_chol_hamoed = ${s.skip_chol_hamoed}, skip_fasts = ${s.skip_fasts},
      blocked_action = ${s.blocked_action}, deferred_since = null, locked_until = null, updated_at = now()
    where id = ${id}`;
  await refreshNext(id).catch(() => null);
  return ok({ id });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const id = Number((await params).id);
  await sql`delete from schedules where id = ${id}`;
  return ok({ deleted: id });
});
