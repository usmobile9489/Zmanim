import { readTwilio } from '@/lib/twilio';
import { applyStatus } from '@/lib/runner';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { params, ok, query } = await readTwilio(req);
  if (!ok) return new Response('Forbidden', { status: 403 });
  await applyStatus(Number(query.get('id')), params);
  return new Response('', { status: 204 });
}
