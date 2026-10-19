import { ok, handle } from '@/lib/api';
import { weeksOfYear, currentHebYear, hebYearLabel } from '@/lib/hebrew';
import { todayISO } from '@/lib/time';

export const dynamic = 'force-dynamic';

/** Parsha weeks of a Hebrew year (Sunday → Shabbos). */
export const GET = handle(async (req: Request) => {
  const today = todayISO();
  const cur = currentHebYear(today);
  const year = Number(new URL(req.url).searchParams.get('year')) || cur;
  const weeks = weeksOfYear(year);
  const currentIndex = weeks.findIndex((w) => w.days[0] <= today && today <= w.shabbos);
  return ok({
    year,
    label: hebYearLabel(year),
    weeks,
    currentIndex,
    years: [cur, cur + 1, cur + 2, cur + 3].map((y) => ({ year: y, label: hebYearLabel(y) })),
  });
});
