export const ok = (data: any, init: ResponseInit = {}) =>
  Response.json(data, { ...init, headers: { 'Cache-Control': 'no-store', ...(init.headers || {}) } });

export const bad = (message: string, status = 400) => ok({ error: message }, { status });

export function handle<T extends any[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (e: any) {
      console.error(e);
      return bad(e?.message || String(e), 500);
    }
  };
}

export async function body(req: Request) {
  try { return await req.json(); } catch { return {}; }
}
