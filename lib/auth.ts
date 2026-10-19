// Works in both the Edge middleware and Node route handlers (Web Crypto only).

export const COOKIE = 'zc_session';
const enc = new TextEncoder();

function secret() {
  return process.env.SESSION_SECRET || `zc:${process.env.DASHBOARD_PASSWORD || ''}`;
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function safeEqual(a: string, b: string) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function makeSession(days = 30) {
  const exp = Date.now() + days * 864e5;
  return `${exp}.${await hmac(String(exp))}`;
}

export async function verifySession(value?: string | null) {
  if (!value || !process.env.DASHBOARD_PASSWORD) return false;
  const [exp, sig] = value.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(exp));
}
