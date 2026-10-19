import { sql } from '@/lib/db';
import { ok, bad, handle, body } from '@/lib/api';
import { callService, haBase } from '@/lib/ha';
import { weeksOfYear, hebYearLabel, currentHebYear } from '@/lib/hebrew';
import { todayISO } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Runs YidCal's own yidcal.generate_luach once per selected year.
 * { style, years: number[], range: { type: 'all' | 'range' | 'weeks_from_now', from?, to?, weeks? }, location?, time_format? }
 */
export const POST = handle(async (req: Request) => {
  const b = await body(req);
  const style = ['weekly_yidcal', 'yearly_sheet', 'yearly_multi_page'].includes(b.style) ? b.style : 'weekly_yidcal';
  const years: number[] = (Array.isArray(b.years) && b.years.length ? b.years : [currentHebYear(todayISO())]).map(Number).slice(0, 6);
  const range = b.range || { type: 'all' };
  const results: any[] = [];

  for (const year of years) {
    const data: any = { style, hebrew_year: String(year), no_notification: true };
    if (b.time_format === '24' || b.time_format === '12') data.time_format = b.time_format;
    if (b.location) data.location = String(b.location);
    let title = `YidCal ${style === 'weekly_yidcal' ? 'weekly' : style === 'yearly_sheet' ? 'yearly sheet' : 'yearly booklet'} · ${hebYearLabel(year)}`;

    if (style === 'weekly_yidcal') {
      const weeks = weeksOfYear(year);
      let from = weeks[0], to = weeks[weeks.length - 1];
      if (range.type === 'range') {
        from = weeks.find((w) => w.shabbos === range.from) || from;
        to = weeks.find((w) => w.shabbos === range.to) || from;
        if (to.shabbos < from.shabbos) [from, to] = [to, from];
        title += ` · ${from.he}${to.shabbos !== from.shabbos ? ' – ' + to.he : ''}`;
      } else if (range.type === 'weeks_from_now') {
        const all = [...weeksOfYear(currentHebYear(todayISO())), ...weeksOfYear(currentHebYear(todayISO()) + 1)];
        const i0 = Math.max(0, all.findIndex((w) => w.days[0] <= todayISO() && todayISO() <= w.shabbos));
        const w = all[i0 + Math.max(0, Number(range.weeks) || 0)] || all[i0];
        from = to = w;
        title = `YidCal weekly · ${w.he}`;
      }
      data.start_date = from.days[0];
      data.end_date = to.shabbos;
    }

    try {
      const res: any = await callService('yidcal', 'generate_luach', data, true, 240000);
      const sr = res?.service_response || res || {};
      const rel = sr.pdf_url || sr.pdf_path || '';
      if (!rel) throw new Error('YidCal did not return a PDF link. Is “Create the Generate Luach (PDF) service” on in YidCal options?');
      const url = /^https?:\/\//.test(rel) ? rel : haBase() + (rel.startsWith('/') ? rel : '/' + rel);
      await sql`insert into luach_files (title, url) values (${title}, ${url})`;
      results.push({ year, title, url });
      if (range.type === 'weeks_from_now') break; // one week only needs one file
    } catch (e: any) {
      results.push({ year, title, error: e?.message || String(e) });
    }
  }
  if (!results.length) return bad('Nothing generated');
  return ok({ results });
});
