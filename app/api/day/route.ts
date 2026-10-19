import { ok, bad, handle } from '@/lib/api';
import { lookupZmanim, ZMAN_KEYS } from '@/lib/zmanim';
import { hebDate, dayNotes, parshaOf } from '@/lib/hebrew';
import { fromISODate } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = handle(async (req: Request) => {
  const u = new URL(req.url);
  const date = u.searchParams.get('date') || '';
  const zip = u.searchParams.get('zip') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('date=YYYY-MM-DD required');
  const z = (await lookupZmanim([date], zip))[date];
  const rows = Object.entries(ZMAN_KEYS)
    .filter(([k]) => z?.z?.[k])
    .map(([k, v]) => ({ key: k, he: v.he, text: z.z[k].text }));
  if (z?.candle) rows.push({ key: 'candle', he: 'הדלקת נרות', text: z.candle.text });
  if (z?.havdalah) rows.push({ key: 'havdalah', he: z.motzeiLabel === 'Motzei Yom Tov' ? 'מוצאי יום טוב' : 'מוצאי שבת', text: z.havdalah.text });
  return ok({
    date,
    eng: fromISODate(date).toFormat('cccc, MMMM d'),
    heb: hebDate(date, true),
    parsha: parshaOf(date).he,
    notes: dayNotes(date),
    label: z?.label || '',
    zmanim: rows,
  });
});
