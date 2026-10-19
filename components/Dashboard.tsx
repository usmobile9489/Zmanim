'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, Modal, PhoneIcon, StatusPill, fmtWhen } from './ui';
import ScheduleModal from './ScheduleModal';
import { LuachCustomModal, LuachYidModal } from './LuachModals';

type M = { type: string; data?: any } | null;

export default function Dashboard() {
  const [d, setD] = useState<any>(null);
  const [loadErr, setLoadErr] = useState('');
  const [m, setM] = useState<M>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setD(await api('/api/overview')); setLoadErr(''); } catch (e: any) { setLoadErr(e.message); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const toast = useCallback((msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 4500); }, []);
  const close = useCallback(() => setM(null), []);
  const saved = useCallback((msg: string) => { setM(null); toast(msg); load(); }, [load, toast]);

  async function act(id: number, action: string, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    try {
      const r = await api(`/api/schedules/${id}/action`, { body: { action } });
      if (action === 'now') {
        const okN = (r.results || []).filter((x: any) => x.ok).length;
        toast(`Calling ${okN} of ${(r.results || []).length} people`);
      } else toast(action === 'skip' ? 'Skipped — next call moved forward' : 'Updated');
      load();
    } catch (e: any) { toast(e.message); }
    setBusy(false);
  }

  if (!d) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
        {loadErr ? <div className="panel"><p className="err">{loadErr}</p><button className="btn" onClick={load}>Try again</button></div> : <p className="muted">Loading…</p>}
      </main>
    );
  }

  const st = d.status;
  const needsSetup = !st.ha.ok || !st.twilio || st.lastTickAgoMin === null || st.lastTickAgoMin > 5;
  const todayRow = d.week.find((w: any) => w.today);
  const callsThisWeek = d.week.reduce((n: number, w: any) => n + w.calls.length, 0);

  return (
    <div className="app">
      <nav className="side" aria-label="Main">
        <div className="brand"><PhoneIcon /> Zmanim Caller</div>
        <a href="#top">Overview</a>
        <a href="#week">This week</a>
        <a href="#schedules">Schedules</a>
        <a href="#people">People</a>
        <a href="#luach">Luach</a>
        <a href="#calls">Call log</a>
        <a href="#" onClick={(e) => { e.preventDefault(); setM({ type: 'settings' }); }}>Settings</a>
        <div className="foot muted">Times from YidCal · Home Assistant</div>
      </nav>

      <main className="main" id="top">
        <div className="row">
          <div>
            <div className="heb" style={{ fontSize: 30, fontWeight: 700 }}>{d.today.heb} · {d.today.parsha}</div>
            <div className="muted">{d.today.eng}</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className={`pill ${st.ha.ok ? 'p-ok' : 'p-bad'}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => setM({ type: 'settings' })}>
              {st.ha.ok ? '● HA connected' : '● HA not connected'}
            </button>
            <button type="button" className={`pill ${st.twilio ? 'p-ok' : 'p-bad'}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => setM({ type: 'settings' })}>
              {st.twilio ? '● Twilio ready' : '● Twilio not set up'}
            </button>
            <button type="button" className={`pill ${st.lastTickAgoMin !== null && st.lastTickAgoMin <= 5 ? 'p-ok' : 'p-warn'}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => setM({ type: 'settings' })}>
              {st.lastTickAgoMin === null ? '● Pinger not running' : st.lastTickAgoMin <= 5 ? '● Pinger running' : `● Pinger last ran ${st.lastTickAgoMin} min ago`}
            </button>
          </div>
        </div>

        {needsSetup && (
          <button type="button" className="card" style={{ marginTop: 18, borderColor: '#5c4a22', background: '#231f16' }} onClick={() => setM({ type: 'settings' })}>
            <span className="ct">Finish setup</span>
            <span className="cs">
              {[!st.ha.ok && 'connect Home Assistant', !st.twilio && 'add Twilio details', (st.lastTickAgoMin === null || st.lastTickAgoMin > 5) && 'start the every-minute pinger'].filter(Boolean).join(' · ')}
              {' '}— tap for steps
            </span>
          </button>
        )}

        <section className="hero">
          {d.next ? (
            <>
              <div>
                <div style={{ color: '#b3ddf8', fontSize: 14, fontWeight: 600 }}>NEXT CALL</div>
                <div className="t" style={{ fontSize: 34, margin: '2px 0' }}>{d.next.when}</div>
                <div style={{ fontSize: 17 }}>{d.next.name} → {d.next.who}</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button type="button" className="btn" disabled={busy} onClick={() => act(d.next.id, 'now', `Call everyone in “${d.next.name}” right now?`)}>Call now</button>
                <button type="button" className="btn g" disabled={busy} onClick={() => act(d.next.id, 'skip', 'Skip this call? The schedule moves to its next time.')}>Skip this one</button>
                <button type="button" className="btn g" onClick={() => setM({ type: 'schedule', data: d.schedules.find((s: any) => s.id === d.next.id) })}>Details</button>
              </div>
            </>
          ) : (
            <>
              <div>
                <div style={{ color: '#b3ddf8', fontSize: 14, fontWeight: 600 }}>NEXT CALL</div>
                <div style={{ fontSize: 22, fontWeight: 700, margin: '2px 0' }}>Nothing planned yet</div>
                <div className="muted">Add people, then create a schedule.</div>
              </div>
              <button type="button" className="btn" onClick={() => setM({ type: 'schedule', data: null })}>+ New schedule</button>
            </>
          )}
        </section>

        <div className="tiles">
          <div className="tile"><div className="lab">Candle lighting · {d.shabbos.erevDay}</div><div className="val t gold">{d.shabbos.candle || '—'}</div></div>
          <div className="tile"><div className="lab">{d.shabbos.motzeiLabel}</div><div className="val t gold">{d.shabbos.havdalah || '—'}</div></div>
          <div className="tile"><div className="lab">Maariv 60 · today</div><div className="val t">{todayRow?.maariv_60 || '—'}</div></div>
          <div className="tile"><div className="lab">Calls this week</div><div className="val t">{callsThisWeek}</div></div>
        </div>
        {st.zError && <p className="err" style={{ marginTop: 8 }}>Zmanim: {st.zError}</p>}

        <div id="week" className="sec">This week · tap a day</div>
        <div className="scrollx">
          <div className="week">
            {d.week.map((w: any) => (
              <button type="button" key={w.iso} className={`day${w.today ? ' today' : ''}${w.noMelacha ? ' shab' : ''}`} onClick={() => setM({ type: 'day', data: w })}>
                <span style={{ fontSize: 12, color: '#9aa3ad', fontWeight: 600 }}>{w.eng}{w.today ? ' · TODAY' : ''}</span>
                <span className="heb" style={{ fontSize: 18 }}>{w.heb}</span>
                {w.notes.map((n: string) => <span key={n} className="heb gold" style={{ fontSize: 13 }}>{n}</span>)}
                {w.calls.map((c: any, i: number) => <span key={i} className="dot">{c.short} {c.name}</span>)}
                {w.candle && <span style={{ fontSize: 12 }} className="muted">Candles {w.candle}</span>}
                {w.havdalah && <span style={{ fontSize: 12 }} className="muted">Motzei {w.havdalah}</span>}
              </button>
            ))}
          </div>
        </div>

        <div id="schedules" className="row">
          <div className="sec">Schedules</div>
          <button type="button" className="btn" onClick={() => setM({ type: 'schedule', data: null })}>+ New schedule</button>
        </div>
        <div className="grid">
          {d.schedules.map((s: any) => (
            <button type="button" key={s.id} className="card" onClick={() => setM({ type: 'schedule', data: s })}>
              <span className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
                <span className="ct">{s.name}</span>
                <span className={`pill ${s.active ? (s.last_error && !s.next_run_at ? 'p-bad' : 'p-ok') : 'p-off'}`}>{s.active ? (s.last_error && !s.next_run_at ? 'Problem' : 'Active') : 'Paused'}</span>
              </span>
              <span className="cs">{s.when}</span>
              <span className="cs">{s.who}</span>
              <span style={{ fontSize: 14, marginTop: 6 }}>Next: <span className="t gold">{s.next}</span></span>
              {s.last_error && <span className="err" style={{ fontSize: 13 }}>{s.last_error}</span>}
            </button>
          ))}
          {d.schedules.length === 0 && <button type="button" className="card add" onClick={() => setM({ type: 'schedule', data: null })}><span className="ct">+ Create your first schedule</span></button>}
        </div>

        <div id="people" className="sec">People &amp; groups</div>
        <div className="grid">
          <button type="button" className="card" onClick={() => setM({ type: 'people' })}>
            <span className="ct">Everyone</span>
            <span className="cs">{d.people.contacts.length} people</span>
          </button>
          {d.people.groups.map((g: any) => (
            <button type="button" key={g.id} className="card" onClick={() => setM({ type: 'group', data: g })}>
              <span className="ct">{g.name}</span>
              <span className="cs">{g.members.length} {g.members.length === 1 ? 'person' : 'people'}</span>
            </button>
          ))}
          <button type="button" className="card add" onClick={() => setM({ type: 'person', data: null })}><span className="ct">+ Add person</span></button>
          <button type="button" className="card add" onClick={() => setM({ type: 'group', data: null })}><span className="ct">+ New group</span></button>
        </div>

        <div id="luach" className="sec">Luach</div>
        <div className="grid">
          <button type="button" className="card" onClick={() => setM({ type: 'luachC' })}>
            <span className="ct">Custom luach</span>
            <span className="cs">Pick zmanim + parshas → PDF</span>
            {d.layouts.length > 0 && <span className="gold" style={{ fontSize: 14, marginTop: 6 }}>Saved: {d.layouts.map((l: any) => l.name).join(' · ')}</span>}
          </button>
          <button type="button" className="card" onClick={() => setM({ type: 'luachY' })}>
            <span className="ct">YidCal luach</span>
            <span className="cs">Weekly card · yearly sheet · yearly booklet</span>
          </button>
          {d.files.slice(0, 4).map((f: any) => (
            <a key={f.id} className="card" href={f.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <span className="ct" style={{ fontSize: 15 }}>{f.title}</span>
              <span className="cs">{fmtWhen(f.created_at)} · Open PDF</span>
            </a>
          ))}
        </div>

        <div id="calls" className="sec">Recent calls</div>
        <div className="grid">
          {d.calls.map((c: any) => (
            <button type="button" key={c.id} className="card" onClick={() => setM({ type: 'call', data: c })}>
              <span className="row" style={{ gap: 8 }}><span className="ct">{c.contact_name || '—'}</span><StatusPill status={c.status} /></span>
              <span className="cs">{c.schedule_name}</span>
              <span className="cs">{fmtWhen(c.created_at)}{c.duration ? ` · ${c.duration} sec` : ''}</span>
            </button>
          ))}
          <button type="button" className="card add" onClick={() => setM({ type: 'calls' })}><span className="ct">View full call log</span></button>
        </div>
      </main>

      {m?.type === 'schedule' && <ScheduleModal initial={m.data} people={d.people} onClose={close} onSaved={saved} toast={toast} />}
      {m?.type === 'day' && <DayModal day={m.data} onClose={close} />}
      {m?.type === 'person' && <PersonModal person={m.data} groups={d.people.groups} onClose={close} onSaved={saved} />}
      {m?.type === 'people' && <PeopleModal people={d.people} onClose={close} onEdit={(p: any) => setM({ type: 'person', data: p })} />}
      {m?.type === 'group' && <GroupModal group={m.data} contacts={d.people.contacts} onClose={close} onSaved={saved} />}
      {m?.type === 'call' && <CallModal call={m.data} onClose={close} toast={toast} />}
      {m?.type === 'calls' && <CallsModal onClose={close} onOpen={(c: any) => setM({ type: 'call', data: c })} />}
      {m?.type === 'luachC' && <LuachCustomModal onClose={close} layouts={d.layouts} onLayoutsChanged={load} toast={toast} />}
      {m?.type === 'luachY' && <LuachYidModal onClose={close} onDone={load} />}
      {m?.type === 'settings' && <SettingsModal status={st} onClose={close} toast={toast} reload={load} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}

function DayModal({ day, onClose }: any) {
  const [z, setZ] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api(`/api/day?date=${day.iso}`).then(setZ).catch((e) => setErr(e.message)); }, [day.iso]);
  return (
    <Modal title="Day details" onClose={onClose}>
      <div className="heb gold" style={{ fontSize: 22, marginBottom: 4 }}>{day.heb} · {z?.parsha || ''}</div>
      <div className="muted" style={{ marginBottom: 8 }}>{z?.eng || day.eng}{z?.notes?.length ? ` · ${z.notes.join(' · ')}` : ''}</div>
      {err && <p className="err">{err}</p>}
      {!z && !err && <p className="muted">Getting zmanim from YidCal…</p>}
      {z?.zmanim?.map((r: any) => <div className="zr" key={r.key}><span className="heb" style={{ fontSize: 17 }}>{r.he}</span><span className="t">{r.text}</span></div>)}
      <div style={{ fontWeight: 600, margin: '16px 0 6px' }}>Calls this day</div>
      {day.calls.length === 0 && <p className="muted" style={{ margin: 0 }}>{day.noMelacha ? 'No calls — Shabbos / Yom Tov.' : 'No calls planned.'}</p>}
      {day.calls.map((c: any, i: number) => <div className="zr" key={i}><span>{c.name}</span><span className="t">{c.time}</span></div>)}
    </Modal>
  );
}

function PersonModal({ person, groups, onClose, onSaved }: any) {
  const [p, setP] = useState<any>(() => person ? { ...person } : { name: '', phone: '', zip: '', groups: [] });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const toggle = (id: number) => setP((x: any) => ({ ...x, groups: x.groups.includes(id) ? x.groups.filter((g: number) => g !== id) : [...x.groups, id] }));
  async function save() {
    setBusy(true); setErr('');
    try {
      if (person?.id) await api(`/api/contacts/${person.id}`, { method: 'PUT', body: p });
      else await api('/api/contacts', { body: p });
      onSaved(person?.id ? 'Saved' : 'Person added');
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }
  async function remove() {
    if (!confirm(`Remove ${person.name}?`)) return;
    try { await api(`/api/contacts/${person.id}`, { method: 'DELETE' }); onSaved('Removed'); } catch (e: any) { setErr(e.message); }
  }
  return (
    <Modal title={person?.id ? 'Edit person' : 'Add person'} onClose={onClose}>
      <label className="lbl" htmlFor="pn">Name</label>
      <input id="pn" className="in" value={p.name} placeholder="Full name" onChange={(e) => setP({ ...p, name: e.target.value })} />
      <label className="lbl" htmlFor="pp">Phone</label>
      <input id="pp" className="in" type="tel" value={p.phone} placeholder="(718) 555-0100" onChange={(e) => setP({ ...p, phone: e.target.value })} />
      <label className="lbl" htmlFor="pz">ZIP <span className="muted" style={{ fontWeight: 400 }}>(optional, for your notes)</span></label>
      <input id="pz" className="in" value={p.zip} onChange={(e) => setP({ ...p, zip: e.target.value })} />
      {groups.length > 0 && <>
        <span className="lbl">Groups</span>
        <div className="chips">{groups.map((g: any) => <button type="button" key={g.id} className={`chip${p.groups.includes(g.id) ? ' on' : ''}`} onClick={() => toggle(g.id)}>{g.name}</button>)}</div>
      </>}
      {err && <p className="err">{err}</p>}
      <div className="foot-btns">
        {person?.id && <button type="button" className="btn danger" onClick={remove}>Remove</button>}
        <div className="r"><button type="button" className="btn" disabled={busy} onClick={save}>Save</button></div>
      </div>
    </Modal>
  );
}

function PeopleModal({ people, onClose, onEdit }: any) {
  const [q, setQ] = useState('');
  const list = people.contacts.filter((c: any) => !q || `${c.name} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal title={`Everyone (${people.contacts.length})`} onClose={onClose}>
      <input className="in" aria-label="Search" placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="list" style={{ marginTop: 8 }}>
        {list.map((c: any) => (
          <div className="zr" key={c.id} style={{ alignItems: 'center' }}>
            <span><b>{c.name}</b><br /><span className="muted" style={{ fontSize: 14 }}>{c.phone}</span></span>
            <button type="button" className="btn g sm" onClick={() => onEdit(c)}>Edit</button>
          </div>
        ))}
        {list.length === 0 && <p className="muted">No one yet.</p>}
      </div>
      <div className="foot-btns"><div className="r"><button type="button" className="btn" onClick={() => onEdit(null)}>+ Add person</button></div></div>
    </Modal>
  );
}

function GroupModal({ group, contacts, onClose, onSaved }: any) {
  const [name, setName] = useState(group?.name || '');
  const [members, setMembers] = useState<number[]>(group?.members || []);
  const [err, setErr] = useState('');
  const toggle = (id: number) => setMembers((ms) => (ms.includes(id) ? ms.filter((x) => x !== id) : [...ms, id]));
  async function save() {
    setErr('');
    try {
      if (group?.id) await api(`/api/groups/${group.id}`, { method: 'PUT', body: { name, members } });
      else await api('/api/groups', { body: { name, members } });
      onSaved('Group saved');
    } catch (e: any) { setErr(e.message); }
  }
  async function remove() {
    if (!confirm(`Delete group “${group.name}”? People stay in your list.`)) return;
    try { await api(`/api/groups/${group.id}`, { method: 'DELETE' }); onSaved('Group deleted'); } catch (e: any) { setErr(e.message); }
  }
  return (
    <Modal title={group?.id ? group.name : 'New group'} onClose={onClose}>
      <label className="lbl" htmlFor="gn">Group name</label>
      <input id="gn" className="in" value={name} onChange={(e) => setName(e.target.value)} />
      <span className="lbl">Members ({members.length})</span>
      {contacts.length === 0 && <p className="muted">Add people first.</p>}
      <div className="list">
        {contacts.map((c: any) => (
          <label className="ck" key={c.id}><input type="checkbox" checked={members.includes(c.id)} onChange={() => toggle(c.id)} /> {c.name} <span className="muted" style={{ fontSize: 13 }}>{c.phone}</span></label>
        ))}
      </div>
      {err && <p className="err">{err}</p>}
      <div className="foot-btns">
        {group?.id && <button type="button" className="btn danger" onClick={remove}>Delete group</button>}
        <div className="r"><button type="button" className="btn" onClick={save}>Save</button></div>
      </div>
    </Modal>
  );
}

function CallModal({ call, onClose, toast }: any) {
  const [busy, setBusy] = useState(false);
  async function again() {
    if (!call.schedule_id || !call.phone) return;
    if (!confirm(`Call ${call.contact_name} again now?`)) return;
    setBusy(true);
    try {
      const r = await api(`/api/schedules/${call.schedule_id}/action`, { body: { action: 'test', phone: call.phone, name: call.contact_name } });
      toast(r.results?.[0]?.ok ? 'Calling now' : `Failed: ${r.results?.[0]?.error}`);
      onClose();
    } catch (e: any) { toast(e.message); }
    setBusy(false);
  }
  return (
    <Modal title="Call details" onClose={onClose}>
      <div className="zr"><span>Person</span><span>{call.contact_name || '—'}</span></div>
      {call.phone && <div className="zr"><span>Phone</span><span>{call.phone}</span></div>}
      <div className="zr"><span>Schedule</span><span>{call.schedule_name}</span></div>
      <div className="zr"><span>When</span><span>{fmtWhen(call.created_at)}</span></div>
      <div className="zr"><span>Result</span><StatusPill status={call.status} /></div>
      {call.duration ? <div className="zr"><span>Length</span><span>{call.duration} sec</span></div> : null}
      {call.reason && <div className="zr"><span>Note</span><span style={{ textAlign: 'right' }}>{call.reason}</span></div>}
      {call.message && <div className="box" style={{ marginTop: 10 }}>“{call.message}”</div>}
      {call.schedule_id && call.phone && <div className="foot-btns"><div className="r"><button type="button" className="btn" disabled={busy} onClick={again}>Call again now</button></div></div>}
    </Modal>
  );
}

function CallsModal({ onClose, onOpen }: any) {
  const [status, setStatus] = useState('');
  const [data, setData] = useState<any>(null);
  useEffect(() => { setData(null); api(`/api/calls?limit=200${status ? `&status=${status}` : ''}`).then(setData).catch(() => setData({ calls: [] })); }, [status]);
  const count = (s: string) => data?.counts?.find((c: any) => c.status === s)?.n || 0;
  return (
    <Modal title="Call log" onClose={onClose} wide>
      <div className="muted" style={{ fontSize: 14, marginBottom: 10 }}>
        Last 7 days: {count('answered')} answered · {count('voicemail')} voicemail · {count('no-answer') + count('busy') + count('failed')} not reached · {count('skipped')} skipped
      </div>
      <div className="chips" style={{ marginBottom: 10 }}>
        {[['', 'All'], ['answered', 'Answered'], ['voicemail', 'Voicemail'], ['no-answer', 'No answer'], ['failed', 'Failed'], ['skipped', 'Skipped']].map(([k, l]) => (
          <button type="button" key={k} className={`chip${status === k ? ' on' : ''}`} onClick={() => setStatus(k)}>{l}</button>
        ))}
      </div>
      <div className="list" style={{ maxHeight: '60vh' }}>
        {!data && <p className="muted">Loading…</p>}
        {data?.calls?.map((c: any) => (
          <button type="button" key={c.id} className="zr" style={{ width: '100%', background: 'none', border: 0, borderTop: '1px solid #2c333c', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => onOpen(c)}>
            <span><b>{c.contact_name || '—'}</b> · {c.schedule_name}<br /><span className="muted" style={{ fontSize: 13 }}>{fmtWhen(c.created_at)}{c.reason ? ` · ${c.reason}` : ''}</span></span>
            <StatusPill status={c.status} />
          </button>
        ))}
        {data && !data.calls?.length && <p className="muted">No calls yet.</p>}
      </div>
    </Modal>
  );
}

function SettingsModal({ status, onClose, toast, reload }: any) {
  const [ha, setHa] = useState<any>(status.ha);
  const [busy, setBusy] = useState(false);
  async function testHa() {
    setBusy(true);
    try { setHa(await api('/api/settings', { body: { action: 'test_ha' } })); } catch (e: any) { setHa({ ok: false, message: e.message }); }
    setBusy(false);
  }
  async function clearCache() {
    setBusy(true);
    try { await api('/api/settings', { body: { action: 'clear_cache' } }); toast('Zmanim refreshed from YidCal'); reload(); } catch (e: any) { toast(e.message); }
    setBusy(false);
  }
  async function logout() { await api('/api/logout', { body: {} }); window.location.href = '/login'; }
  const pinger = `${status.appUrl}/api/tick?key=YOUR_CRON_SECRET`;
  return (
    <Modal title="Settings & setup" onClose={onClose}>
      <div className="zr"><span><b>Home Assistant</b><br /><span className="muted" style={{ fontSize: 13 }}>{ha.message}</span></span><span className={`pill ${ha.ok ? 'p-ok' : 'p-bad'}`}>{ha.ok ? 'Connected' : 'Not connected'}</span></div>
      <div className="zr"><span><b>Twilio</b><br /><span className="muted" style={{ fontSize: 13 }}>TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM</span></span><span className={`pill ${status.twilio ? 'p-ok' : 'p-bad'}`}>{status.twilio ? 'Ready' : 'Missing'}</span></div>
      <div className="zr"><span><b>Every-minute pinger</b><br /><span className="muted" style={{ fontSize: 13 }}>{status.lastTick ? `Last ran ${fmtWhen(status.lastTick)}` : 'Hasn’t run yet'}</span></span><span className={`pill ${status.lastTickAgoMin !== null && status.lastTickAgoMin <= 5 ? 'p-ok' : 'p-warn'}`}>{status.lastTickAgoMin !== null && status.lastTickAgoMin <= 5 ? 'Running' : 'Not running'}</span></div>

      <span className="lbl">Pinger URL (cron-job.org, every 1 minute)</span>
      <div className="box" style={{ wordBreak: 'break-all', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }}>{pinger}</div>
      <p className="muted" style={{ fontSize: 13 }}>Replace YOUR_CRON_SECRET with the CRON_SECRET value from Vercel → Settings → Environment Variables.{!status.cronKeySet && ' (CRON_SECRET isn’t set yet.)'}</p>

      <span className="lbl">YidCal options this app needs</span>
      <p className="muted" style={{ fontSize: 14, margin: 0 }}>In HA: Settings → Devices &amp; Services → YidCal → gear icon → turn on “Zmanim Lookup &amp; service call sensors” and “Generate Luach (PDF) service”.</p>

      <div className="foot-btns">
        <button type="button" className="btn g" onClick={logout}>Sign out</button>
        <div className="r">
          <button type="button" className="btn g" disabled={busy} onClick={clearCache}>Refresh zmanim</button>
          <button type="button" className="btn" disabled={busy} onClick={testHa}>Test HA</button>
        </div>
      </div>
    </Modal>
  );
}
