import { ok, bad, handle, body } from '@/lib/api';
import { haPing, haConfigured } from '@/lib/ha';
import { clearZmanimCache } from '@/lib/zmanim';
import { sql } from '@/lib/db';
import { refreshNext } from '@/lib/runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export const POST = handle(async (req: Request) => {
  const b = await body(req);
  if (b.action === 'test_ha') return ok(haConfigured() ? await haPing() : { ok: false, message: 'HA_URL / HA_TOKEN not set' });
  if (b.action === 'clear_cache') {
    await clearZmanimCache();
    const rows = await sql`select id from schedules where active`;
    for (const r of rows) await refreshNext(r.id).catch(() => null);
    return ok({ cleared: true });
  }
  return bad('Unknown action');
});
