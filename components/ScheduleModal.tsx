'use client';
import { useEffect, useRef, useState } from 'react';
import { api, Modal, ZMAN_OPTIONS, EVENT_OPTIONS, FILLINS, TEMPLATES, WEEKDAYS } from './ui';

const DEFAULT_CFG = {
  event: 'erev_shabbos_yt', daysBefore: 0, time: '10:00', weekdays: [7, 1, 2, 3, 4],
  zman: 'maariv_60', offset: 30, direction: 'before',
};

export const NEW_SCHEDULE = {
  name: '', active: true, recipients: { contacts: [], groups: [] }, mode: 'event', cfg: DEFAULT_CFG, zip: '',
  wording: TEMPLATES[0][1], repeat: 2, pause: 2, press_one: true, voicemail: true, retry: false,
  skip_melacha: true, skip_chol_hamoed: false, skip_fasts: false, blocked_action: 'skip',
};

const MODES: [string, string, string][] = [
  ['event', 'Before an event', 'Erev Shabbos, Rosh Chodesh, בה״ב…'],
  ['zman', 'Around a zman', 'e.g. 30 min before Maariv'],
  ['days', 'Selected days', 'Pick weekdays + a time'],
  ['daily', 'Every day', 'Same time daily'],
];

export default function ScheduleModal({ initial, people, onClose, onSaved, toast }: any) {
  const editing = !!initial?.id;
  const [s, setS] = useState<any>(() => ({ ...NEW_SCHEDULE, ...(initial || {}), cfg: { ...DEFAULT_CFG, ...(initial?.cfg || {}) } }));
  const [prev, setPrev] = useState<any>(null);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ta = useRef<HTMLTextAreaElement>(null);
  const set = (patch: any) => setS((x: any) => ({ ...x, ...patch }));
  const setCfg = (patch: any) => setS((x: any) => ({ ...x, cfg: { ...x.cfg, ...patch } }));

  // Live preview (debounced).
  const key = JSON.stringify([s.mode, s.cfg, s.zip, s.wording]);
  useEffect(() => {
    setLoadingPrev(true);
    const t = setTimeout(async () => {
      try { setPrev(await api('/api/preview', { body: s })); } catch (e: any) { setPrev({ error: e.message }); }
      setLoadingPrev(false);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function insert(token: string) {
    const el = ta.current;
    const text = `{${token}}`;
    if (!el) return set({ wording: s.wording + text });
    const a = el.selectionStart ?? s.wording.length, b = el.selectionEnd ?? a;
    const w = s.wording.slice(0, a) + text + s.wording.slice(b);
    set({ wording: w });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + text.length, a + text.length); });
  }

  const toggleIn = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const toggleGroup = (id: number) => set({ recipients: { ...s.recipients, groups: toggleIn(s.recipients.groups, id) } });
  const toggleContact = (id: number) => set({ recipients: { ...s.recipients, contacts: toggleIn(s.recipients.contacts, id) } });
  const toggleDay = (d: number) => setCfg({ weekdays: toggleIn(s.cfg.weekdays || [], d) });

  async function save() {
    setBusy(true); setErr('');
    try {
      if (editing) await api(`/api/schedules/${initial.id}`, { method: 'PUT', body: s });
      else await api('/api/schedules', { body: s });
      onSaved(editing ? 'Schedule saved' : 'Schedule created');
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  async function remove() {
    if (!confirm(`Delete “${s.name || 'this schedule'}”? This can’t be undone.`)) return;
    setBusy(true);
    try { await api(`/api/schedules/${initial.id}`, { method: 'DELETE' }); onSaved('Schedule deleted'); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  async function test() {
    const last = (typeof localStorage !== 'undefined' && localStorage.getItem('zc_test_phone')) || '';
    const phone = prompt('Call which number for the test?', last);
    if (!phone) return;
    try { localStorage.setItem('zc_test_phone', phone); } catch { /* ignore */ }
    setBusy(true);
    try {
      const r = await api(`/api/schedules/${editing ? initial.id : 'draft'}/action`, { body: { action: 'test', phone, schedule: s } });
      const res = r.results?.[0];
      toast(res?.ok ? 'Test call placed — your phone should ring' : `Test call failed: ${res?.error || 'unknown error'}`);
    } catch (e: any) { toast(`Test call failed: ${e.message}`); }
    setBusy(false);
  }

  const groups = people?.groups || [];
  const contacts = people?.contacts || [];

  return (
    <Modal title={editing ? 'Edit schedule' : 'New schedule'} onClose={onClose}>
      <label className="lbl" htmlFor="sn">Name</label>
      <input id="sn" className="in" value={s.name} placeholder="e.g. Shabbos times" onChange={(e) => set({ name: e.target.value })} />

      <span className="lbl">Call these people</span>
      {groups.length + contacts.length === 0 && <p className="muted" style={{ margin: 0 }}>Add people first (People → Add person).</p>}
      {groups.length > 0 && (
        <div className="chips" style={{ marginBottom: 8 }}>
          {groups.map((g: any) => (
            <button type="button" key={`g${g.id}`} className={`chip${s.recipients.groups.includes(g.id) ? ' on' : ''}`} onClick={() => toggleGroup(g.id)}>
              Group: {g.name} ({g.members.length})
            </button>
          ))}
        </div>
      )}
      <div className="chips">
        {contacts.map((c: any) => (
          <button type="button" key={`c${c.id}`} className={`chip${s.recipients.contacts.includes(c.id) ? ' on' : ''}`} onClick={() => toggleContact(c.id)}>
            {c.name}
          </button>
        ))}
      </div>

      <span className="lbl">When</span>
      <div className="seg">
        {MODES.map(([id, label, hint]) => (
          <button type="button" key={id} className={`opt${s.mode === id ? ' on' : ''}`} onClick={() => set({ mode: id })}>
            {label}<br /><span className="muted" style={{ fontSize: 12 }}>{hint}</span>
          </button>
        ))}
      </div>

      {s.mode === 'event' && (
        <div className="g2" style={{ marginTop: 10 }}>
          <div>
            <label className="lbl" htmlFor="ev">Event</label>
            <select id="ev" className="in" value={s.cfg.event} onChange={(e) => setCfg({ event: e.target.value })}>
              {EVENT_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl" htmlFor="db">Call</label>
            <select id="db" className="in" value={s.cfg.daysBefore} onChange={(e) => setCfg({ daysBefore: Number(e.target.value) })}>
              <option value={0}>On the day</option>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} day{n > 1 ? 's' : ''} before</option>)}
            </select>
          </div>
          <div>
            <label className="lbl" htmlFor="t1">At</label>
            <input id="t1" className="in" type="time" value={s.cfg.time} onChange={(e) => setCfg({ time: e.target.value })} />
          </div>
        </div>
      )}

      {s.mode === 'zman' && (
        <>
          <div className="g2" style={{ marginTop: 10 }}>
            <div>
              <label className="lbl" htmlFor="mn">Minutes</label>
              <input id="mn" className="in" type="number" min={0} value={s.cfg.offset} onChange={(e) => setCfg({ offset: Number(e.target.value) })} />
            </div>
            <div>
              <label className="lbl" htmlFor="ba">Before / after</label>
              <select id="ba" className="in" value={s.cfg.direction} onChange={(e) => setCfg({ direction: e.target.value })}>
                <option value="before">before</option><option value="after">after</option>
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="zm">Zman</label>
              <select id="zm" className="in" value={s.cfg.zman} onChange={(e) => setCfg({ zman: e.target.value })}>
                {ZMAN_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          </div>
          <span className="lbl">On these days</span>
          <div className="chips">
            {WEEKDAYS.map(([n, l]) => <button type="button" key={n} className={`chip${(s.cfg.weekdays || []).includes(n) ? ' on' : ''}`} onClick={() => toggleDay(n)}>{l}</button>)}
          </div>
        </>
      )}

      {s.mode === 'days' && (
        <>
          <span className="lbl">On these days</span>
          <div className="chips">
            {WEEKDAYS.map(([n, l]) => <button type="button" key={n} className={`chip${(s.cfg.weekdays || []).includes(n) ? ' on' : ''}`} onClick={() => toggleDay(n)}>{l}</button>)}
          </div>
          <label className="lbl" htmlFor="t2">At</label>
          <input id="t2" className="in" type="time" style={{ maxWidth: 200 }} value={s.cfg.time} onChange={(e) => setCfg({ time: e.target.value })} />
        </>
      )}

      {s.mode === 'daily' && (
        <>
          <label className="lbl" htmlFor="t3">Every day at</label>
          <input id="t3" className="in" type="time" style={{ maxWidth: 200 }} value={s.cfg.time} onChange={(e) => setCfg({ time: e.target.value })} />
        </>
      )}

      <label className="lbl" htmlFor="zp">ZIP code for zmanim <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
      <input id="zp" className="in" value={s.zip} placeholder="Blank = Home Assistant’s location" onChange={(e) => set({ zip: e.target.value })} />

      <div className="row" style={{ marginTop: 14 }}>
        <label className="lbl" htmlFor="wd" style={{ margin: 0 }}>What it says</label>
        <select className="in" style={{ width: 'auto', minHeight: 36, padding: '4px 8px', fontSize: 14 }} value="" aria-label="Use a ready-made message"
          onChange={(e) => { const t = TEMPLATES.find(([n]) => n === e.target.value); if (t) set({ wording: t[1] }); }}>
          <option value="">Ready-made messages…</option>
          {TEMPLATES.map(([n]) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <textarea id="wd" ref={ta} className="in" rows={3} style={{ marginTop: 6 }} value={s.wording} onChange={(e) => set({ wording: e.target.value })} />
      <div className="chips" style={{ marginTop: 8 }}>
        {FILLINS.map((f) => <button type="button" key={f} className="chip v" onClick={() => insert(f)}>{`{${f}}`}</button>)}
      </div>

      <div className="box" style={{ marginTop: 10 }}>
        <span className="muted" style={{ fontSize: 13 }}>{loadingPrev ? 'Updating preview…' : 'They’ll hear:'}</span><br />
        {prev?.error ? <span className="err">{prev.error}</span> : <span>{prev?.message ? `“${prev.message}”` : '—'}</span>}
        {prev?.missing?.length > 0 && <div className="err" style={{ marginTop: 6 }}>Not available for this call: {prev.missing.map((m: string) => `{${m}}`).join(', ')}</div>}
        {prev?.runs?.length > 0 && (
          <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            Next calls: {prev.runs.map((r: any) => r.label + (r.event ? ` (${r.event})` : '')).join(' · ')}
          </div>
        )}
      </div>

      <div className="row" style={{ marginTop: 6, alignItems: 'flex-end' }}>
        <div>
          <span className="lbl">Say it</span>
          <div className="step">
            <button type="button" aria-label="Fewer times" onClick={() => set({ repeat: Math.max(1, s.repeat - 1) })}>−</button>
            <span>{s.repeat} {s.repeat === 1 ? 'time' : 'times'}</span>
            <button type="button" aria-label="More times" onClick={() => set({ repeat: Math.min(5, s.repeat + 1) })}>+</button>
          </div>
        </div>
        <div style={{ minWidth: 180 }}>
          <label className="lbl" htmlFor="pz">Pause between</label>
          <select id="pz" className="in" value={s.pause} onChange={(e) => set({ pause: Number(e.target.value) })}>
            {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n} second{n > 1 ? 's' : ''}</option>)}
          </select>
        </div>
      </div>
      <label className="ck"><input type="checkbox" checked={s.press_one} onChange={(e) => set({ press_one: e.target.checked })} /> “Press 1 to hear it again”</label>
      <label className="ck"><input type="checkbox" checked={s.voicemail} onChange={(e) => set({ voicemail: e.target.checked })} /> Leave it on voicemail if no one answers</label>
      <label className="ck"><input type="checkbox" checked={s.retry} onChange={(e) => set({ retry: e.target.checked })} /> If no answer, try once more after 10 minutes</label>

      <span className="lbl">Don’t call during</span>
      <label className="ck"><input type="checkbox" checked={s.skip_melacha} onChange={(e) => set({ skip_melacha: e.target.checked })} /> Shabbos &amp; Yom Tov (issur melacha)</label>
      <label className="ck"><input type="checkbox" checked={s.skip_chol_hamoed} onChange={(e) => set({ skip_chol_hamoed: e.target.checked })} /> Chol Hamoed</label>
      <label className="ck"><input type="checkbox" checked={s.skip_fasts} onChange={(e) => set({ skip_fasts: e.target.checked })} /> Fast days</label>
      <label className="lbl" htmlFor="ba2">If a call lands in a blocked time</label>
      <select id="ba2" className="in" value={s.blocked_action} onChange={(e) => set({ blocked_action: e.target.value })}>
        <option value="skip">Skip it</option>
        <option value="defer">Call right after it ends</option>
      </select>
      <label className="ck" style={{ marginTop: 6 }}><input type="checkbox" checked={s.active} onChange={(e) => set({ active: e.target.checked })} /> Schedule is active</label>

      {err && <p className="err">{err}</p>}
      <div className="foot-btns">
        {editing && <button type="button" className="btn danger" disabled={busy} onClick={remove}>Delete</button>}
        <div className="r">
          <button type="button" className="btn g" disabled={busy} onClick={test}>Test call</button>
          <button type="button" className="btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </Modal>
  );
}
