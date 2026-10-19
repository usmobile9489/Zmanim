import { cookies } from 'next/headers';
import { ok } from '@/lib/api';
import { COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  (await cookies()).delete(COOKIE);
  return ok({ ok: true });
}
