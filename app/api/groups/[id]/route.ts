import { sql } from '@/lib/db';
import { ok, bad, handle, body } from '@/lib/api';
import { setMembers } from '@/lib/data';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const id = Number((await params).id);
  const b = await body(req);
  const name = String(b.name || '').trim();
  if (!name) return bad('Group name is required');
  await sql`update groups set name = ${name} where id = ${id}`;
  await setMembers(id, b.members);
  return ok({ id });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const id = Number((await params).id);
  await sql`delete from groups where id = ${id}`;
  return ok({ deleted: id });
});
