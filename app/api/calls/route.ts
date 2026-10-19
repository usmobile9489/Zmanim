import { sql } from '@/lib/db';
import { ok, handle } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  const u = new URL(req.url);
  const status = u.searchParams.get('status') || '';
  const limit = Math.min(500, Number(u.searchParams.get('limit')) || 100);
  const rows = status
    ? await sql`select * from call_log where status = ${status} order by created_at desc limit ${limit}`
    : await sql`select * from call_log order by created_at desc limit ${limit}`;
  const counts = await sql`select status, count(*)::int as n from call_log
    where created_at > now() - interval '7 days' group by status`;
  return ok({ calls: rows, counts });
});
