import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, verifySession } from './lib/auth';

// Everything needs the dashboard login except the login page, the pinger (own secret)
// and Twilio's callbacks (checked by Twilio signature).
const PUBLIC = [/^\/login/, /^\/api\/login/, /^\/api\/tick/, /^\/api\/twilio\//, /^\/_next\//, /^\/favicon/, /^\/icon/];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PUBLIC.some((r) => r.test(path))) return NextResponse.next();
  if (await verifySession(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  if (path.startsWith('/api/')) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
