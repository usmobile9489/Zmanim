import { sql } from '@/lib/db';
import { ok, bad, handle, body } from '@/lib/api';
import { setGroups } from '@/lib/data';
import { loadPeople } from '@/lib/data';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => ok(await loadPeople()));


export const POST = handle(async (req: Request) => {
  const b = await body(req);
  const name = String(b.name || '').trim();
  const phone = String(b.phone || '').trim();
  if (!name || !phone) return bad('Name and phone are required');
  const r = await sql`insert into contacts (name, phone, zip) values (${name}, ${phone}, ${String(b.zip || '').trim()}) returning id`;
  await setGroups(r[0].id, b.groups);
  return ok({ id: r[0].id });
});
