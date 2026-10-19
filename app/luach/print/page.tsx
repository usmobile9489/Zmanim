'use client';
import { useEffect, useState } from 'react';

type Cfg = { title: string; subtitle: string; columns: [string, string][]; zip: string; groups: { title: string; days: string[] }[] };

export default function PrintLuach() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [rows, setRows] = useState<Record<string, any>>({});
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    let c: Cfg | null = null;
    try { c = JSON.parse(localStorage.getItem('zc_print') || 'null'); } catch { /* ignore */ }
    if (!c) { setErr('Nothing to print — go back and press Generate.'); return; }
    setCfg(c);
    const dates = Array.from(new Set(c.groups.flatMap((g) => g.days)));
    setTotal(dates.length);
    (async () => {
      for (let i = 0; i < dates.length; i += 70) {
        const batch = dates.slice(i, i + 70);
        try {
          const r = await fetch('/api/luach/rows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dates: batch, zip: c!.zip }) });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || 'Failed');
          setRows((prev) => { const n = { ...prev }; for (const row of j.rows) n[row.iso] = row; return n; });
          setDone((d) => d + batch.length);
        } catch (e: any) { setErr(e.message); return; }
      }
    })();
  }, []);

  const loading = total > 0 && done < total;
  return (
    <div className="print-page">
      <div className="bar noprint">
        <span>{err ? <span className="err">{err}</span> : loading ? `Getting zmanim from YidCal… ${done} / ${total} days` : 'Ready. Use Print, then “Save as PDF”.'}</span>
        <span style={{ display: 'flex', gap: 8 }}>
          <button className="btn" disabled={loading || !!err} onClick={() => window.print()}>Print / Save PDF</button>
          <button className="btn g" onClick={() => window.close()}>Close</button>
        </span>
      </div>
      {cfg && (
        <div className="sheet" dir="rtl">
          <div style={{ textAlign: 'center', fontSize: 13 }}>בס״ד</div>
          <h1>{cfg.title}</h1>
          <div className="subt">{cfg.subtitle}{cfg.zip ? ` · ${cfg.zip}` : ''}</div>
          <table>
            <thead>
              <tr>
                <th>יום</th><th>תאריך</th>
                {cfg.columns.map(([k, l]) => <th key={k}>{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {cfg.groups.map((g, gi) => (
                <Group key={gi} g={g} cfg={cfg} rows={rows} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Group({ g, cfg, rows }: { g: any; cfg: Cfg; rows: Record<string, any> }) {
  return (
    <>
      {g.title && <tr className="wk"><td colSpan={cfg.columns.length + 2}>{g.title}</td></tr>}
      {g.days.map((iso: string) => {
        const r = rows[iso];
        const shab = r?.day === 'שבת';
        return (
          <tr key={iso} className={shab ? 'shab' : ''}>
            <td className="h">{r?.day || ''}</td>
            <td className="h">{r?.heb || iso}{r?.notes ? <div style={{ fontSize: 11 }}>{r.notes}</div> : null}</td>
            {cfg.columns.map(([k]) => <td key={k}>{r ? r.z?.[k] || '' : '…'}</td>)}
          </tr>
        );
      })}
    </>
  );
}
