import { sql, json } from '@/lib/db';
import { ok, bad, handle, body } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => ok({ layouts: await sql`select * from luach_layouts order by name` }));

export const POST = handle(async (req: Request) => {
  const b = await body(req);
  const name = String(b.name || '').trim();
  if (!name) return bad('Name the layout');
  const r = await sql`insert into luach_layouts (name, config) values (${name}, ${json(b.config || {})}::jsonb) returning id`;
  return ok({ id: r[0].id });
});

export const DELETE = handle(async (req: Request) => {
  const id = Number(new URL(req.url).searchParams.get('id'));
  await sql`delete from luach_layouts where id = ${id}`;
  return ok({ deleted: id });
});
