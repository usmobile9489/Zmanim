import { sql } from '@/lib/db';
import { ok, bad, handle, body } from '@/lib/api';
import { setMembers } from '@/lib/data';

export const dynamic = 'force-dynamic';


export const POST = handle(async (req: Request) => {
  const b = await body(req);
  const name = String(b.name || '').trim();
  if (!name) return bad('Group name is required');
  const r = await sql`insert into groups (name) values (${name}) returning id`;
  await setMembers(r[0].id, b.members);
  return ok({ id: r[0].id });
});
