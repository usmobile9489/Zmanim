'use client';
import { useEffect, useState } from 'react';
import { api, Modal, LUACH_COLUMNS } from './ui';

const weeksCache: Record<number, any> = {};
async function getWeeks(year?: number) {
  const k = year || 0;
  if (!weeksCache[k]) weeksCache[k] = await api(`/api/luach/weeks${year ? `?year=${year}` : ''}`);
  return weeksCache[k];
}

/** "Week N from now" across the year boundary. */
async function weekFromNow(n: number) {
  const cur = await getWeeks();
  const idx = Math.max(0, cur.currentIndex) + n;
  if (idx < cur.weeks.length) return cur.weeks[idx];
  const next = await getWeeks(cur.year + 1);
  return next.weeks[Math.min(idx - cur.weeks.length, next.weeks.length - 1)];
}

const RANGES: [string, string][] = [
  ['all', 'All parshas (whole year)'],
  ['selected', 'Selected parshas'],
  ['single', 'One parsha'],
  ['weeks', 'Weeks from now'],
  ['dates', 'Custom dates'],
];

export function LuachCustomModal({ onClose, layouts, onLayoutsChanged, toast }: any) {
  const [cols, setCols] = useState<string[]>(['shma_mga', 'maariv_60']);
  const [info, setInfo] = useState<any>(null);
  const [year, setYear] = useState<number>(0);
  const [range, setRange] = useState('single');
  const [selected, setSelected] = useState<string[]>([]);
  const [single, setSingle] = useState('');
  const [weeksAhead, setWeeksAhead] = useState(0);
  const [howMany, setHowMany] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [zip, setZip] = useState('');
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    getWeeks(year || undefined).then((w) => {
      setInfo(w);
      if (!year) setYear(w.year);
      const cur = w.weeks[Math.max(0, w.currentIndex)] || w.weeks[0];
      setSingle((s) => s || cur?.shabbos || '');
    }).catch((e) => setErr(e.message));
  }, [year]);

  useEffect(() => {
    if (range !== 'weeks') return;
    weekFromNow(weeksAhead).then(setPreview).catch(() => setPreview(null));
  }, [range, weeksAhead]);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function buildGroups() {
    const weeks = info?.weeks || [];
    if (range === 'all') return weeks.map((w: any) => ({ title: w.he, days: w.days }));
    if (range === 'selected') return weeks.filter((w: any) => selected.includes(w.shabbos)).map((w: any) => ({ title: w.he, days: w.days }));
    if (range === 'single') { const w = weeks.find((x: any) => x.shabbos === single); return w ? [{ title: w.he, days: w.days }] : []; }
    if (range === 'weeks') {
      const out = [];
      for (let i = 0; i < Math.max(1, howMany); i++) { const w = await weekFromNow(weeksAhead + i); if (w) out.push({ title: w.he, days: w.days }); }
      return out;
    }
    if (range === 'dates') {
      if (!from || !to || to < from) return [];
      const days: string[] = [];
      for (let d = new Date(from + 'T12:00:00'); d <= new Date(to + 'T12:00:00') && days.length < 400; d.setDate(d.getDate() + 1)) {
        days.push(d.toISOString().slice(0, 10));
      }
      return [{ title: '', days }];
    }
    return [];
  }

  async function generate() {
    setErr('');
    if (!cols.length) return setErr('Pick at least one zman');
    const groups = await buildGroups();
    if (!groups.length) return setErr('Pick which parshas or dates to include');
    const ordered = LUACH_COLUMNS.filter(([k]) => cols.includes(k));
    const cfg = { title: title || 'לוח זמנים', subtitle: info?.label ? `שנת ${info.label}` : '', columns: ordered, zip, groups };
    try { localStorage.setItem('zc_print', JSON.stringify(cfg)); } catch { return setErr('Your browser blocked local storage'); }
    window.open('/luach/print', '_blank');
  }

  async function saveLayout() {
    const name = prompt('Name this layout', title || 'My luach');
    if (!name) return;
    await api('/api/luach/layouts', { body: { name, config: { cols, range, weeksAhead, howMany, zip, title } } });
    onLayoutsChanged();
    toast('Layout saved');
  }
  function applyLayout(l: any) {
    const c = l.config || {};
    if (c.cols) setCols(c.cols);
    if (c.range) setRange(c.range);
    if (c.weeksAhead !== undefined) setWeeksAhead(c.weeksAhead);
    if (c.howMany) setHowMany(c.howMany);
    setZip(c.zip || '');
    setTitle(c.title || '');
  }
  async function deleteLayout(l: any) {
    if (!confirm(`Delete layout “${l.name}”?`)) return;
    await api(`/api/luach/layouts?id=${l.id}`, { method: 'DELETE' });
    onLayoutsChanged();
  }

  const weeks = info?.weeks || [];
  return (
    <Modal title="Custom luach" onClose={onClose} wide>
      {layouts?.length > 0 && (
        <>
          <span className="lbl">Saved layouts</span>
          <div className="chips">
            {layouts.map((l: any) => (
              <span key={l.id} style={{ display: 'inline-flex', gap: 4 }}>
                <button type="button" className="chip" onClick={() => applyLayout(l)}>{l.name}</button>
                <button type="button" className="chip" aria-label={`Delete ${l.name}`} onClick={() => deleteLayout(l)}>✕</button>
              </span>
            ))}
          </div>
        </>
      )}

      <span className="lbl">Zmanim to include</span>
      <div className="chips">
        {LUACH_COLUMNS.map(([k, l]) => (
          <button type="button" key={k} className={`chip heb${cols.includes(k) ? ' on' : ''}`} style={{ fontSize: 15 }} onClick={() => setCols(toggle(cols, k))}>{l}</button>
        ))}
      </div>

      <span className="lbl">Which weeks</span>
      <div className="seg">
        {RANGES.map(([k, l]) => <button type="button" key={k} className={`opt${range === k ? ' on' : ''}`} onClick={() => setRange(k)}>{l}</button>)}
      </div>

      {['all', 'selected', 'single'].includes(range) && info && (
        <>
          <label className="lbl" htmlFor="yr">Year</label>
          <select id="yr" className="in heb" value={year} onChange={(e) => { setYear(Number(e.target.value)); setSelected([]); setSingle(''); }}>
            {(info.years || []).map((y: any) => <option key={y.year} value={y.year}>{y.label} ({y.year})</option>)}
          </select>
        </>
      )}

      {range === 'selected' && (
        <>
          <div className="row" style={{ marginTop: 10 }}>
            <span className="muted" style={{ fontSize: 14 }}>{selected.length} selected</span>
            <div className="chips">
              <button type="button" className="chip" onClick={() => setSelected(weeks.map((w: any) => w.shabbos))}>Select all</button>
              <button type="button" className="chip" onClick={() => setSelected([])}>Clear</button>
            </div>
          </div>
          <div className="list chips" style={{ marginTop: 8 }}>
            {weeks.map((w: any) => (
              <button type="button" key={w.shabbos} className={`chip heb${selected.includes(w.shabbos) ? ' on' : ''}`} style={{ fontSize: 15 }} onClick={() => setSelected(toggle(selected, w.shabbos))}>
                {w.he.replace('פרשת ', '')}
              </button>
            ))}
          </div>
        </>
      )}

      {range === 'single' && (
        <>
          <label className="lbl" htmlFor="sp">Parsha</label>
          <select id="sp" className="in heb" value={single} onChange={(e) => setSingle(e.target.value)}>
            {weeks.map((w: any) => <option key={w.shabbos} value={w.shabbos}>{w.he} · {w.shabbos}</option>)}
          </select>
        </>
      )}

      {range === 'weeks' && (
        <div className="g2">
          <div>
            <label className="lbl" htmlFor="wa">Start how many weeks from now</label>
            <select id="wa" className="in" value={weeksAhead} onChange={(e) => setWeeksAhead(Number(e.target.value))}>
              {Array.from({ length: 53 }, (_, i) => <option key={i} value={i}>{i === 0 ? 'This week' : i === 1 ? 'Next week' : `${i} weeks from now`}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl" htmlFor="hm">How many weeks</label>
            <input id="hm" className="in" type="number" min={1} max={52} value={howMany} onChange={(e) => setHowMany(Math.max(1, Math.min(52, Number(e.target.value) || 1)))} />
          </div>
          {preview && <p className="muted heb" style={{ gridColumn: '1 / -1', margin: 0, fontSize: 16 }}>Starts with {preview.he} ({preview.shabbos})</p>}
        </div>
      )}

      {range === 'dates' && (
        <div className="g2">
          <div><label className="lbl" htmlFor="df">From</label><input id="df" className="in" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="lbl" htmlFor="dt">To</label><input id="dt" className="in" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      )}

      <div className="g2">
        <div><label className="lbl" htmlFor="lt">Title</label><input id="lt" className="in heb" value={title} placeholder="לוח זמנים" onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label className="lbl" htmlFor="lz">ZIP code <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label><input id="lz" className="in" value={zip} placeholder="Home Assistant location" onChange={(e) => setZip(e.target.value)} /></div>
      </div>
      {range === 'all' && <p className="muted" style={{ fontSize: 13 }}>A whole year takes a minute or two the first time, while YidCal calculates every day.</p>}
      {err && <p className="err">{err}</p>}
      <div className="foot-btns">
        <button type="button" className="btn g" onClick={saveLayout}>Save as layout</button>
        <div className="r"><button type="button" className="btn" onClick={generate}>Generate PDF</button></div>
      </div>
    </Modal>
  );
}

export function LuachYidModal({ onClose, onDone }: any) {
  const [info, setInfo] = useState<any>(null);
  const [style, setStyle] = useState('weekly_yidcal');
  const [years, setYears] = useState<number[]>([]);
  const [range, setRange] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [weeks, setWeeks] = useState(0);
  const [location, setLocation] = useState('');
  const [tf, setTf] = useState('12');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    getWeeks().then((w) => {
      setInfo(w);
      setYears([w.year]);
      const cur = w.weeks[Math.max(0, w.currentIndex)] || w.weeks[0];
      setFrom(cur?.shabbos || ''); setTo(cur?.shabbos || '');
    }).catch((e) => setErr(e.message));
  }, []);

  const weekly = style === 'weekly_yidcal';
  const multiYear = !weekly || range === 'all';
  const toggleYear = (y: number) => setYears((ys) => (multiYear ? (ys.includes(y) ? ys.filter((x) => x !== y) : [...ys, y].sort()) : [y]));

  async function go() {
    setBusy(true); setErr(''); setResults([]);
    try {
      const r = await api('/api/luach/yidcal', {
        body: { style, years: multiYear ? years : years.slice(0, 1), range: weekly ? { type: range, from, to, weeks } : { type: 'all' }, location, time_format: tf },
      });
      setResults(r.results || []);
      onDone();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <Modal title="YidCal luach" onClose={onClose}>
      <span className="lbl">Style</span>
      <div className="seg">
        {[['weekly_yidcal', 'Weekly card'], ['yearly_sheet', 'Yearly sheet'], ['yearly_multi_page', 'Yearly booklet']].map(([k, l]) => (
          <button type="button" key={k} className={`opt${style === k ? ' on' : ''}`} onClick={() => setStyle(k)}>{l}</button>
        ))}
      </div>

      {weekly && (
        <>
          <span className="lbl">Which weeks</span>
          <div className="seg">
            {[['all', 'All parshas'], ['range', 'From – to parsha'], ['weeks_from_now', 'Weeks from now']].map(([k, l]) => (
              <button type="button" key={k} className={`opt${range === k ? ' on' : ''}`} onClick={() => { setRange(k); if (k !== 'all') setYears((ys) => ys.slice(0, 1)); }}>{l}</button>
            ))}
          </div>
          {range === 'range' && info && (
            <div className="g2">
              <div><label className="lbl" htmlFor="yf">From</label>
                <select id="yf" className="in heb" value={from} onChange={(e) => setFrom(e.target.value)}>
                  {info.weeks.map((w: any) => <option key={w.shabbos} value={w.shabbos}>{w.he}</option>)}
                </select></div>
              <div><label className="lbl" htmlFor="yt">To</label>
                <select id="yt" className="in heb" value={to} onChange={(e) => setTo(e.target.value)}>
                  {info.weeks.map((w: any) => <option key={w.shabbos} value={w.shabbos}>{w.he}</option>)}
                </select></div>
            </div>
          )}
          {range === 'weeks_from_now' && (
            <>
              <label className="lbl" htmlFor="yw">Which week</label>
              <select id="yw" className="in" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                {Array.from({ length: 53 }, (_, i) => <option key={i} value={i}>{i === 0 ? 'This week' : i === 1 ? 'Next week' : `${i} weeks from now`}</option>)}
              </select>
            </>
          )}
        </>
      )}

      {info && range !== 'weeks_from_now' && (
        <>
          <span className="lbl">{multiYear ? 'Years (pick one or more)' : 'Year'}</span>
          <div className="chips">
            {info.years.map((y: any) => (
              <button type="button" key={y.year} className={`chip heb${years.includes(y.year) ? ' on' : ''}`} style={{ fontSize: 15 }} onClick={() => toggleYear(y.year)}>{y.label}</button>
            ))}
          </div>
        </>
      )}

      <div className="g2">
        <div><label className="lbl" htmlFor="yl">Location</label><input id="yl" className="in" value={location} placeholder="ZIP or city · blank = HA" onChange={(e) => setLocation(e.target.value)} /></div>
        <div><label className="lbl" htmlFor="ytf">Time format</label>
          <select id="ytf" className="in" value={tf} onChange={(e) => setTf(e.target.value)}><option value="12">12-hour</option><option value="24">24-hour</option></select></div>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>YidCal keeps only its 4 newest PDFs, so download each one soon after it’s made.</p>
      {err && <p className="err">{err}</p>}
      {results.map((r) => (
        <div className="zr" key={r.title}>
          <span>{r.title}</span>
          {r.url ? <a className="btn sm" href={r.url} target="_blank" rel="noreferrer">Open PDF</a> : <span className="err">{r.error}</span>}
        </div>
      ))}
      <div className="foot-btns"><div className="r"><button type="button" className="btn" disabled={busy || !years.length} onClick={go}>{busy ? 'Generating… (can take a minute)' : 'Generate PDF'}</button></div></div>
    </Modal>
  );
}
