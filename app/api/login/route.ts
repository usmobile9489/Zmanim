import { cookies } from 'next/headers';
import { ok, bad, body } from '@/lib/api';
import { COOKIE, makeSession, safeEqual } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return bad('DASHBOARD_PASSWORD is not set in Vercel yet', 503);
  const b = await body(req);
  if (!safeEqual(String(b.password || ''), pw)) {
    await new Promise((r) => setTimeout(r, 800));
    return bad('Wrong password', 401);
  }
  (await cookies()).set(COOKIE, await makeSession(), {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  return ok({ ok: true });
}
