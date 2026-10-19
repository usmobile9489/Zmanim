import { sql } from '@/lib/db';
import { ok, bad, handle, body } from '@/lib/api';
import { setGroups } from '@/lib/data';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const id = Number((await params).id);
  const b = await body(req);
  const name = String(b.name || '').trim();
  const phone = String(b.phone || '').trim();
  if (!name || !phone) return bad('Name and phone are required');
  await sql`update contacts set name = ${name}, phone = ${phone}, zip = ${String(b.zip || '').trim()} where id = ${id}`;
  await setGroups(id, b.groups);
  return ok({ id });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const id = Number((await params).id);
  await sql`delete from contacts where id = ${id}`;
  return ok({ deleted: id });
});
