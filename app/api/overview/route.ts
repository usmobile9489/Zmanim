import { sql } from '@/lib/db';
import { ok, handle } from '@/lib/api';
import { loadPeople, loadSchedules, nextText } from '@/lib/data';
import { haConfigured, haPing } from '@/lib/ha';
import { twilioConfigured, appUrl } from '@/lib/twilio';
import { lookupZmanim, ZMAN_KEYS } from '@/lib/zmanim';
import { hebDate, dayNotes, dayInfo, blockFrom, parshaOf, hebYearLabel, currentHebYear } from '@/lib/hebrew';
import { projectRuns, rowToSchedule } from '@/lib/schedule';
import { addDays, fromISODate, todayISO, weekStart, toDT, now } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = handle(async () => {
  const today = todayISO();
  const ws = weekStart(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const block = blockFrom(today);

  const [people, ha, recent, layouts, files, tickRow] = await Promise.all([
    loadPeople(),
    haConfigured() ? haPing() : Promise.resolve({ ok: false, message: 'Not set up yet (HA_URL / HA_TOKEN)' }),
    sql`select * from call_log order by created_at desc limit 12`,
    sql`select * from luach_layouts order by name`,
    sql`select * from luach_files order by created_at desc limit 8`,
    sql`select value, updated_at from app_state where key = 'last_tick'`,
  ]);
  const schedules = await loadSchedules(people);

  let z: Record<string, any> = {};
  let zError: string | null = null;
  if (ha.ok) {
    try { z = await lookupZmanim([...days, block.erev, ...block.days], ''); } catch (e: any) { zError = e?.message || String(e); }
  } else zError = ha.message;

  // Calls planned this week.
  const weekFrom = fromISODate(ws);
  const weekTo = fromISODate(addDays(ws, 6)).endOf('day');
  const byDay: Record<string, any[]> = {};
  for (const s of schedules.filter((x: any) => x.active)) {
    try {
      const runs = await projectRuns(rowToSchedule(s), weekFrom, weekTo, 10);
      for (const r of runs) {
        const iso = r.at.toFormat('yyyy-MM-dd');
        (byDay[iso] ||= []).push({ id: s.id, name: s.name, time: r.at.toFormat('h:mm a'), short: r.at.toFormat('h:mma').toLowerCase().replace(':00', ''), at: r.at.toISO() });
      }
    } catch { /* zmanim unavailable for this schedule */ }
  }

  const week = days.map((iso) => {
    const info = dayInfo(iso);
    const dz = z[iso];
    return {
      iso,
      eng: fromISODate(iso).toFormat('ccc d').toUpperCase(),
      heb: hebDate(iso),
      notes: dayNotes(iso),
      today: iso === today,
      noMelacha: info.noMelacha,
      shma_mga: dz?.z?.shma_mga?.text || null,
      shkia: dz?.z?.shkia?.text || null,
      maariv_60: dz?.z?.maariv_60?.text || null,
      candle: dz?.candle?.text || null,
      havdalah: dz?.havdalah?.text || null,
      motzeiLabel: dz?.motzeiLabel || null,
      calls: (byDay[iso] || []).sort((a, b) => a.at.localeCompare(b.at)),
    };
  });

  const next = schedules
    .filter((s: any) => s.active && s.next_run_at)
    .sort((a: any, b: any) => toDT(a.next_run_at).toMillis() - toDT(b.next_run_at).toMillis())[0];

  let hav: any = null, motzei = '';
  for (const d of [block.last, ...block.days]) if (z[d]?.havdalah) { hav = z[d].havdalah; motzei = z[d].motzeiLabel; break; }
  const p = parshaOf(today);

  const todayZ = z[today]
    ? Object.entries(ZMAN_KEYS).filter(([k]) => z[today].z[k]).map(([k, v]) => ({ key: k, he: v.he, text: z[today].z[k].text }))
    : [];

  return ok({
    today: { iso: today, heb: hebDate(today, true), parsha: p.he, eng: fromISODate(today).toFormat('cccc, MMMM d'), hebYear: currentHebYear(today), hebYearLabel: hebYearLabel(currentHebYear(today)) },
    shabbos: {
      label: parshaOf(block.days[0] || today).he,
      erevDay: fromISODate(block.erev).toFormat('ccc'),
      candle: z[block.erev]?.candle?.text || null,
      havdalah: hav?.text || null,
      motzeiLabel: motzei || (block.endsWithYomTov ? 'Motzei Yom Tov' : 'Motzei Shabbos'),
      days: block.days.length,
    },
    todayZ,
    week,
    next: next ? { id: next.id, name: next.name, who: next.who, when: nextText(next.next_run_at) } : null,
    schedules,
    people,
    calls: recent,
    layouts,
    files,
    status: {
      ha,
      zError,
      twilio: twilioConfigured(),
      appUrl: appUrl(),
      lastTick: tickRow[0]?.updated_at || null,
      lastTickAgoMin: tickRow[0]?.updated_at ? Math.round(now().diff(toDT(tickRow[0].updated_at), 'minutes').minutes) : null,
      cronKeySet: !!process.env.CRON_SECRET,
    },
  });
});
