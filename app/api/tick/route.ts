import { sql, json } from '@/lib/db';
import { ok, bad, handle } from '@/lib/api';
import { safeEqual } from '@/lib/auth';
import { tick } from '@/lib/runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Hit every minute by an outside pinger: /api/tick?key=CRON_SECRET */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET || '';
  const u = new URL(req.url);
  const key = u.searchParams.get('key') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!secret || !safeEqual(key, secret)) return bad('Unauthorized', 401);
  const result = await tick();
  await sql`insert into app_state (key, value, updated_at) values ('last_tick', ${json(result)}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
  return ok(result);
}

export const GET = handle(run);
export const POST = handle(run);
