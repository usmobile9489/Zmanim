import { ok, bad, handle, body } from '@/lib/api';
import { lookupZmanim } from '@/lib/zmanim';
import { hebDate, dayNameHe, parshaOf, dayNotes } from '@/lib/hebrew';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Zmanim rows for a batch of dates (the print page asks in batches). */
export const POST = handle(async (req: Request) => {
  const b = await body(req);
  const dates: string[] = (Array.isArray(b.dates) ? b.dates : []).filter((d: any) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (!dates.length) return bad('No dates');
  if (dates.length > 80) return bad('Too many dates in one request (max 80)');
  const z = await lookupZmanim(dates, String(b.zip || ''));
  const rows = dates.map((iso) => {
    const d = z[iso];
    const vals: Record<string, string> = {};
    for (const [k, v] of Object.entries(d?.z || {})) vals[k] = (v as any).text;
    if (d?.candle) vals.candle = d.candle.text;
    if (d?.havdalah) vals.havdalah = d.havdalah.text;
    return {
      iso,
      day: dayNameHe(iso),
      heb: hebDate(iso),
      parsha: parshaOf(iso).he,
      notes: dayNotes(iso).join(' · '),
      motzei: d?.motzeiLabel === 'Motzei Yom Tov' ? 'מוצאי יו״ט' : d?.havdalah ? 'מוצאי שבת' : '',
      z: vals,
    };
  });
  return ok({ rows });
});
