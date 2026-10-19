import { ok, handle, body } from '@/lib/api';
import { cleanSchedule } from '@/lib/data';
import { describe, nextRun, buildVars, render } from '@/lib/schedule';
import { now } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Preview a draft schedule: next 3 times + exactly what will be said. */
export const POST = handle(async (req: Request) => {
  const s = cleanSchedule(await body(req));
  const out: any = { when: describe(s), runs: [], message: '', missing: [], error: null };
  try {
    let cursor = now();
    for (let i = 0; i < 3; i++) {
      const r = await nextRun(s, cursor);
      if (!r) break;
      out.runs.push({ at: r.at.toISO(), label: r.at.toFormat('ccc, MMM d · h:mm a'), event: r.meta.eventName || null });
      if (i === 0) {
        const vars = await buildVars(s, r.meta);
        const m = render(s.wording, vars, { name: 'Moshe Cohen' });
        out.message = m.text;
        out.missing = m.missing;
      }
      cursor = r.at;
    }
    if (!out.runs.length) out.error = 'No upcoming time found for these settings.';
  } catch (e: any) {
    out.error = e?.message || String(e);
  }
  return ok(out);
});
