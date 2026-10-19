import { sql, json } from '@/lib/db';
import { ok, handle, body } from '@/lib/api';
import { cleanSchedule, loadSchedules } from '@/lib/data';
import { refreshNext } from '@/lib/runner';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => ok({ schedules: await loadSchedules() }));

export const POST = handle(async (req: Request) => {
  const s = cleanSchedule(await body(req));
  const r = await sql`insert into schedules
    (name, active, recipients, mode, cfg, zip, wording, repeat, pause, press_one, voicemail, retry,
     skip_melacha, skip_chol_hamoed, skip_fasts, blocked_action)
    values (${s.name}, ${s.active}, ${json(s.recipients)}::jsonb, ${s.mode}, ${json(s.cfg)}::jsonb, ${s.zip}, ${s.wording},
     ${s.repeat}, ${s.pause}, ${s.press_one}, ${s.voicemail}, ${s.retry}, ${s.skip_melacha}, ${s.skip_chol_hamoed},
     ${s.skip_fasts}, ${s.blocked_action})
    returning id`;
  const id = r[0].id;
  await refreshNext(id).catch(() => null);
  return ok({ id });
});
