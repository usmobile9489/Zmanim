# Zmanim Caller

A dashboard that phones people with zmanim — candle lighting, Motzei Shabbos / Yom Tov, Zman Maariv, Rosh Chodesh, בה״ב and more — using **YidCal** in Home Assistant for every time, and **Twilio** for the calls. It also builds printable luachs.

Nothing is created in Home Assistant: the app only reads YidCal sensors and calls YidCal's own services (`yidcal.check_zmanim`, `yidcal.generate_luach`).

## How it works

- **Next.js on Vercel** — the dashboard and API.
- **Neon (Postgres)** — people, groups, schedules, call log, zmanim cache.
- **Home Assistant + YidCal** (through your Cloudflare tunnel) — all times. Hebrew-calendar facts (which day is Yom Tov, Rosh Chodesh, the parsha) come from `@hebcal/core`.
- **Twilio** — places the calls and reads the message (text-to-speech, English).
- **Outside pinger** (cron-job.org) — hits `/api/tick` every minute; anything due gets called.

Calls are skipped (or held until it ends) during issur melacha using `binary_sensor.yidcal_no_melucha`, checked at the moment of the call.

## Setup

1. **YidCal options** (HA → Settings → Devices & Services → YidCal → gear):
   turn on *Zmanim Lookup & service call sensors* and *Generate Luach (PDF) service*.
2. **Database**: run `db/schema.sql` on Neon (already done during setup).
3. **Vercel environment variables** (see `.env.example`):
   `DATABASE_URL`, `HA_URL`, `HA_TOKEN`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`,
   `DASHBOARD_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET`. Redeploy after changing them.
4. **Pinger**: on cron-job.org create a job that runs **every minute**:
   `https://<your-app>.vercel.app/api/tick?key=<CRON_SECRET>`

## Message fill-ins

`{candle_lighting}`, `{havdalah}`, `{motzei_label}` ("Motzei Shabbos" / "Motzei Yom Tov"), `{lighting_schedule}` (every night of a 2–3 day block),
`{event_name}`, `{event_day}`, `{event_date}`, `{parsha}`, `{hebrew_date}`, `{weekday}`, `{name}`, `{first_name}`,
and any zman: `{alos}`, `{talis}`, `{netz}`, `{shma_mga}`, `{shma_gra}`, `{tefilah_mga}`, `{tefilah_gra}`, `{chatzos}`,
`{mincha_gedola}`, `{mincha_ketana}`, `{plag_gra}`, `{plag_mga}`, `{shkia}`, `{tzeis}`, `{maariv_60}`, `{maariv_rt}`, `{chatzos_night}`.

## Notes

- בה״ב dates follow Monday–Thursday–Monday after the first Shabbos of Cheshvan and Iyar.
- The custom luach opens a print-ready page; use *Print → Save as PDF*.
- YidCal keeps only its 4 newest generated PDFs.
