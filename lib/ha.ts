// Minimal Home Assistant REST client. Only reads states and calls YidCal services —
// it never creates automations or changes anything else in HA.

export const haConfigured = () => !!(process.env.HA_URL && process.env.HA_TOKEN);

export const haBase = () => (process.env.HA_URL || '').replace(/\/+$/, '');

async function haFetch(path: string, init: RequestInit = {}, timeoutMs = 20000) {
  if (!haConfigured()) throw new Error('Home Assistant is not configured (HA_URL / HA_TOKEN)');
  const res = await fetch(haBase() + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.HA_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const hint = res.status === 401 ? ' (HA_TOKEN rejected)' : res.status === 403 && /cloudflare|cf-/i.test(text + JSON.stringify([...res.headers])) ? ' (blocked by Cloudflare before reaching HA)' : '';
    throw new Error(`Home Assistant ${res.status}${hint}: ${text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 160)}`);
  }
  return res;
}

export async function haPing() {
  try {
    const r = await haFetch('/api/', {}, 8000);
    const j = await r.json();
    return { ok: true, message: j?.message || 'ok' };
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e) };
  }
}

export async function getState(entity: string): Promise<any> {
  const r = await haFetch(`/api/states/${entity}`);
  return r.json();
}

export async function callService(domain: string, service: string, data: any, returnResponse = false, timeoutMs = 60000) {
  const r = await haFetch(
    `/api/services/${domain}/${service}${returnResponse ? '?return_response' : ''}`,
    { method: 'POST', body: JSON.stringify(data || {}) },
    timeoutMs,
  );
  return r.json().catch(() => ({}));
}
