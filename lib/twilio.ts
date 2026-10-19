import { createHmac } from 'crypto';

export const twilioConfigured = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);

export function appUrl() {
  const explicit = (process.env.APP_URL || '').replace(/\/+$/, '');
  if (explicit) return explicit;
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

/** Normalize a US-style number to E.164; leaves +… numbers alone. */
export function e164(phone: string) {
  const p = (phone || '').trim();
  if (p.startsWith('+')) return '+' + p.slice(1).replace(/\D/g, '');
  const d = p.replace(/\D/g, '');
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d.startsWith('1')) return '+' + d;
  return '+' + d;
}

export async function placeCall(opts: { to: string; callLogId: number; voicemail: boolean }) {
  if (!twilioConfigured()) throw new Error('Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM)');
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const base = appUrl();
  const body = new URLSearchParams();
  body.set('To', e164(opts.to));
  body.set('From', process.env.TWILIO_FROM!);
  body.set('Url', `${base}/api/twilio/voice?id=${opts.callLogId}`);
  body.set('Method', 'POST');
  body.set('StatusCallback', `${base}/api/twilio/status?id=${opts.callLogId}`);
  body.set('StatusCallbackMethod', 'POST');
  body.append('StatusCallbackEvent', 'answered');
  body.append('StatusCallbackEvent', 'completed');
  body.set('Timeout', '30');
  // With voicemail on, wait for the beep so the message lands on the recording.
  body.set('MachineDetection', opts.voicemail ? 'DetectMessageEnd' : 'Enable');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(20000),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${j?.message || 'call failed'}`);
  return j.sid as string;
}

/** Validates X-Twilio-Signature. */
export function validTwilioRequest(fullUrl: string, params: Record<string, string>, signature: string | null) {
  if (process.env.TWILIO_SKIP_SIGNATURE === 'true') return true;
  if (!signature || !process.env.TWILIO_AUTH_TOKEN) return false;
  const data = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], fullUrl);
  const expected = createHmac('sha1', process.env.TWILIO_AUTH_TOKEN).update(Buffer.from(data, 'utf-8')).digest('base64');
  return expected === signature;
}

/** Read Twilio's form POST and check its signature against our public URL. */
export async function readTwilio(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = String(v)));
  const u = new URL(req.url);
  const fullUrl = appUrl() + u.pathname + u.search;
  const ok = validTwilioRequest(fullUrl, params, req.headers.get('x-twilio-signature'));
  return { params, ok, query: u.searchParams };
}

export const xmlEscape = (s: string) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function twiml(inner: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

export const voice = () => process.env.TWILIO_VOICE || 'Polly.Joanna-Neural';

export function say(text: string) {
  return `<Say voice="${voice()}">${xmlEscape(text)}</Say>`;
}
