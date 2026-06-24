import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../context/AuthContext';
import MarketingLeadsPanel from './MarketingLeadsPanel';

const SEGMENTS = ['Coding Agents', 'FSI / Banks', 'App Builders', 'Agents for X', 'EU AI Act', 'Other'];
const STATUSES  = ['Active', 'Paused', 'Complete', 'Converted', 'Disqualified'];
const CHANNELS  = ['Email', 'LinkedIn', 'Call', 'Other'];

const STATUS_COLORS = {
  Active:       '#00B4D8',
  Paused:       '#d29922',
  Complete:     '#7B2FBE',
  Converted:    '#2BAC76',
  Disqualified: '#4B5563',
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ stats }) {
  return (
    <div className="stat-cards" style={{ marginBottom: '1.25rem' }}>
      <div className="stat-card">
        <div className="stat-label">Total Prospects</div>
        <div className="stat-value">{stats.total ?? '—'}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Active</div>
        <div className="stat-value" style={{ color: 'var(--green)' }}>{stats.active ?? '—'}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Contacted Today</div>
        <div className="stat-value">{stats.contacted_today ?? '—'}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Converted This Month</div>
        <div className="stat-value" style={{ color: 'var(--accent)' }}>{stats.converted_this_month ?? '—'}</div>
      </div>
    </div>
  );
}

// ── Prospect form (create/edit) ───────────────────────────────────────────────
function ProspectForm({ prospect, sequences, onClose, onSaved }) {
  const empty = {
    first_name: '', last_name: '', title: '', company: '', email: '',
    linkedin_url: '', segment: '', sequence_id: '', notes: '',
  };
  const [form, setForm] = useState(prospect ? {
    first_name:   prospect.first_name   || '',
    last_name:    prospect.last_name    || '',
    title:        prospect.title        || '',
    company:      prospect.company      || '',
    email:        prospect.email        || '',
    linkedin_url: prospect.linkedin_url || '',
    segment:      prospect.segment      || '',
    sequence_id:  prospect.sequence_id  ? String(prospect.sequence_id) : '',
    notes:        prospect.notes        || '',
  } : empty);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      const method = prospect ? 'PUT' : 'POST';
      const url    = prospect ? `/api/prospects/${prospect.id}` : '/api/prospects';
      const body   = { ...form, sequence_id: form.sequence_id ? Number(form.sequence_id) : null };
      await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{prospect ? 'Edit Prospect' : 'Add Prospect'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <div className="form-grid">
          <label>First Name<input value={form.first_name} onChange={e => set('first_name', e.target.value)} /></label>
          <label>Last Name<input value={form.last_name} onChange={e => set('last_name', e.target.value)} /></label>
          <label>Title<input value={form.title} onChange={e => set('title', e.target.value)} /></label>
          <label>Company<input value={form.company} onChange={e => set('company', e.target.value)} /></label>
          <label>Email<input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></label>
          <label>LinkedIn URL<input value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} /></label>
          <label>Segment
            <select value={form.segment} onChange={e => set('segment', e.target.value)}>
              <option value="">— Select —</option>
              {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>Email Sequence
            <select value={form.sequence_id} onChange={e => set('sequence_id', e.target.value)}>
              <option value="">— None —</option>
              {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="full-width">Notes<textarea value={form.notes} onChange={e => set('notes', e.target.value)} /></label>
        </div>
        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Convert modal ─────────────────────────────────────────────────────────────
function ConvertModal({ prospect, onClose, onConverted }) {
  const [form, setForm] = useState({
    company_name: prospect.company || '',
    segment:      prospect.segment || '',
    deal_stage:   'Qualification',
    deal_value:   '',
    website:      '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleConvert = async () => {
    if (!form.company_name.trim()) { setError('Company name is required'); return; }
    setSaving(true); setError(null);
    try {
      const result = await authFetch(`/api/prospects/${prospect.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, deal_value: form.deal_value ? Number(form.deal_value) : null }),
      });
      onConverted(result.account_id);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Convert to Account</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: '1rem' }}>
          This will create an Account, Contact, and a new Deal in Qualification stage — and mark {prospect.first_name} {prospect.last_name} as Converted.
        </p>
        {error && <div className="error-banner">{error}</div>}
        <div className="form-grid">
          <label className="full-width">Company Name<input value={form.company_name} onChange={e => set('company_name', e.target.value)} /></label>
          <label>Segment
            <select value={form.segment} onChange={e => set('segment', e.target.value)}>
              <option value="">— Select —</option>
              {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>Deal Stage
            <select value={form.deal_stage} onChange={e => set('deal_stage', e.target.value)}>
              {['Prospecting','Qualification','Discovery','Demo'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>Deal Value ($)<input type="number" value={form.deal_value} onChange={e => set('deal_value', e.target.value)} /></label>
          <label>Website<input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" /></label>
        </div>
        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleConvert} disabled={saving}>
            {saving ? 'Converting…' : 'Convert to Account →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Prospect detail modal ─────────────────────────────────────────────────────
function ProspectDetail({ prospectId, sequences, onClose, onRefresh, onConvert }) {
  const [prospect, setProspect] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [copied, setCopied]     = useState(false);
  const [showConvert, setShowConvert] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authFetch(`/api/prospects/${prospectId}`);
      setProspect(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [prospectId]);

  useEffect(() => { load(); }, [load]);

  const advance = async () => {
    setAdvancing(true);
    try {
      const updated = await authFetch(`/api/prospects/${prospectId}/advance`, { method: 'POST' });
      setProspect(prev => ({ ...prev, ...updated, current_step: updated.next_step }));
      onRefresh();
    } catch (err) { alert(err.message); }
    finally { setAdvancing(false); }
  };

  const copyEmail = () => {
    const step = prospect.current_step;
    if (!step) return;
    const text = `Subject: ${step.subject || ''}\n\n${step.body || ''}`;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  if (loading) return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>Loading…</div>
      </div>
    </div>
  );
  if (!prospect) return null;

  const step   = prospect.current_step;
  const isDone = prospect.sequence_stage === 'Complete' || prospect.status === 'Converted';

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h2 style={{ margin: 0 }}>{prospect.first_name} {prospect.last_name}</h2>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                {prospect.title && <>{prospect.title} · </>}{prospect.company}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className="badge" style={{ background: STATUS_COLORS[prospect.status] || '#4B5563' }}>
                {prospect.status}
              </span>
              <button className="btn-icon" onClick={onClose}>✕</button>
            </div>
          </div>

          {/* Info grid */}
          <div className="account-info-grid" style={{ marginBottom: '1.25rem' }}>
            <div className="info-item">
              <div className="info-label">Email</div>
              <div className="info-value">
                {prospect.email ? <a href={`mailto:${prospect.email}`}>{prospect.email}</a> : '—'}
              </div>
            </div>
            <div className="info-item">
              <div className="info-label">LinkedIn</div>
              <div className="info-value">
                {prospect.linkedin_url ? <a href={prospect.linkedin_url} target="_blank" rel="noreferrer">Profile</a> : '—'}
              </div>
            </div>
            <div className="info-item">
              <div className="info-label">Segment</div>
              <div className="info-value">{prospect.segment || '—'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Sequence</div>
              <div className="info-value">{prospect.sequence_name || '—'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Stage</div>
              <div className="info-value">{prospect.sequence_stage || 'Not Started'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Next Action</div>
              <div className="info-value">{fmtDate(prospect.next_action_date)} {prospect.next_action ? `· ${prospect.next_action}` : ''}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Last Contact</div>
              <div className="info-value">{fmtDate(prospect.last_contact_date)}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Assigned To</div>
              <div className="info-value">{prospect.assigned_name || '—'}</div>
            </div>
          </div>

          {/* Notes */}
          {prospect.notes && (
            <div style={{ marginBottom: '1.25rem', padding: '10px 14px', background: 'var(--surface2)', borderRadius: 6, fontSize: 13, whiteSpace: 'pre-wrap' }}>
              {prospect.notes}
            </div>
          )}

          {/* Current step */}
          {step && !isDone && (
            <div className="prospect-step-card">
              <div className="prospect-step-header">
                <span className="prospect-step-label">Step {prospect.sequence_step} — {step.channel}</span>
                {step.subject && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Day {step.day_offset}</span>}
              </div>
              {step.subject && (
                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>{step.subject}</div>
              )}
              {step.body && (
                <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto', lineHeight: 1.6 }}>
                  {step.body}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: '0.75rem' }}>
                {step.subject && (
                  <button className="btn-secondary" style={{ fontSize: 12 }} onClick={copyEmail}>
                    {copied ? '✓ Copied!' : 'Copy Email'}
                  </button>
                )}
                <button className="btn-primary" style={{ fontSize: 12 }} onClick={advance} disabled={advancing}>
                  {advancing ? 'Advancing…' : 'Mark Done & Advance →'}
                </button>
              </div>
            </div>
          )}

          {isDone && prospect.status !== 'Converted' && (
            <div className="info-banner">Sequence complete — ready to convert or follow up.</div>
          )}

          {/* Actions footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
            <button className="btn-secondary" onClick={onClose}>Close</button>
            {prospect.status !== 'Converted' && (
              <button className="btn-primary" onClick={() => setShowConvert(true)}>
                Convert to Account →
              </button>
            )}
            {prospect.status === 'Converted' && prospect.converted_company && (
              <span style={{ fontSize: 13, color: 'var(--green)' }}>
                Converted → {prospect.converted_company}
              </span>
            )}
          </div>
        </div>
      </div>

      {showConvert && (
        <ConvertModal
          prospect={prospect}
          onClose={() => setShowConvert(false)}
          onConverted={(accountId) => { setShowConvert(false); onClose(); onConvert(accountId); }}
        />
      )}
    </>
  );
}

// ── Sequences tab ─────────────────────────────────────────────────────────────
function SequencesTab() {
  const [sequences, setSequences]   = useState([]);
  const [selected, setSelected]     = useState(null);
  const [steps, setSteps]           = useState([]);
  const [newName, setNewName]       = useState('');
  const [newSegment, setNewSegment] = useState('');
  const [adding, setAdding]         = useState(false);
  const [editStep, setEditStep]     = useState(null);

  const loadSequences = async () => {
    const data = await authFetch('/api/sequences');
    setSequences(data);
  };

  const loadSteps = async (id) => {
    const data = await authFetch(`/api/sequences/${id}/steps`);
    setSteps(data);
  };

  useEffect(() => { loadSequences(); }, []);

  const selectSeq = (s) => { setSelected(s); loadSteps(s.id); };

  const createSequence = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const seq = await authFetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), segment: newSegment || null }),
      });
      setNewName(''); setNewSegment('');
      await loadSequences();
      selectSeq(seq);
    } catch (err) { alert(err.message); }
    finally { setAdding(false); }
  };

  const saveStep = async (step) => {
    const url = step.id
      ? `/api/sequences/${selected.id}/steps/${step.id}`
      : `/api/sequences/${selected.id}/steps`;
    const method = step.id ? 'PUT' : 'POST';
    await authFetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(step),
    });
    setEditStep(null);
    loadSteps(selected.id);
    loadSequences();
  };

  const deleteStep = async (stepId) => {
    if (!confirm('Delete this step?')) return;
    await authFetch(`/api/sequences/${selected.id}/steps/${stepId}`, { method: 'DELETE' });
    loadSteps(selected.id);
    loadSequences();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.25rem', alignItems: 'start' }}>
      {/* Sequence list */}
      <div>
        <div className="detail-section" style={{ padding: '1rem' }}>
          <div className="section-title" style={{ marginBottom: '0.75rem' }}>Email Sequences</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sequences.map(s => (
              <button
                key={s.id}
                onClick={() => selectSeq(s)}
                style={{
                  textAlign: 'left', padding: '8px 10px', borderRadius: 6, border: '1px solid',
                  borderColor: selected?.id === s.id ? 'var(--accent)' : 'var(--border)',
                  background: selected?.id === s.id ? 'rgba(0,180,216,0.1)' : 'var(--surface2)',
                  cursor: 'pointer', fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600, color: selected?.id === s.id ? 'var(--accent)' : 'var(--text)' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {s.step_count} steps{s.segment ? ` · ${s.segment}` : ''}
                </div>
              </button>
            ))}
          </div>

          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <input
              value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="New sequence name…"
              style={{ width: '100%', marginBottom: 6, fontSize: 13 }}
            />
            <select value={newSegment} onChange={e => setNewSegment(e.target.value)} style={{ width: '100%', marginBottom: 6, fontSize: 13 }}>
              <option value="">— Segment (optional) —</option>
              {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn-primary" style={{ width: '100%', fontSize: 13 }} onClick={createSequence} disabled={adding || !newName.trim()}>
              {adding ? 'Creating…' : '+ New Sequence'}
            </button>
          </div>
        </div>
      </div>

      {/* Steps editor */}
      <div>
        {!selected ? (
          <div className="detail-section" style={{ textAlign: 'center', color: 'var(--muted)', padding: '3rem' }}>
            Select a sequence to view and edit its steps.
          </div>
        ) : (
          <div className="detail-section">
            <div className="section-header">
              <div>
                <div className="section-title">{selected.name}</div>
                {selected.segment && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>ICP: {selected.segment}</div>}
              </div>
              <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => setEditStep({ step_number: steps.length + 1, channel: 'Email', day_offset: 1, subject: '', body: '' })}>
                + Add Step
              </button>
            </div>

            {steps.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>No steps yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {steps.map((step, i) => (
                  <div key={step.id} className="prospect-step-card">
                    <div className="prospect-step-header">
                      <span className="prospect-step-label">Step {step.step_number} — {step.channel} · Day {step.day_offset}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" onClick={() => setEditStep({ ...step })}>✏️</button>
                        <button className="btn-icon" style={{ color: 'var(--red)', opacity: 1 }} onClick={() => deleteStep(step.id)}>✕</button>
                      </div>
                    </div>
                    {step.subject && <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{step.subject}</div>}
                    {step.body && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'pre-wrap', maxHeight: 100, overflow: 'hidden' }}>
                        {step.body.slice(0, 250)}{step.body.length > 250 ? '…' : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step editor modal */}
      {editStep && (
        <div className="modal-overlay" onClick={() => setEditStep(null)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editStep.id ? 'Edit Step' : `Add Step ${editStep.step_number}`}</h2>
              <button className="btn-icon" onClick={() => setEditStep(null)}>✕</button>
            </div>
            <div className="form-grid">
              <label>Channel
                <select value={editStep.channel} onChange={e => setEditStep(p => ({ ...p, channel: e.target.value }))}>
                  {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>Day Offset
                <input type="number" value={editStep.day_offset} onChange={e => setEditStep(p => ({ ...p, day_offset: Number(e.target.value) }))} />
              </label>
              {editStep.channel === 'Email' && (
                <label className="full-width">Subject
                  <input value={editStep.subject || ''} onChange={e => setEditStep(p => ({ ...p, subject: e.target.value }))} />
                </label>
              )}
              <label className="full-width">
                {editStep.channel === 'Email' ? 'Email Body' : 'Notes / Script'}
                <textarea
                  value={editStep.body || ''}
                  onChange={e => setEditStep(p => ({ ...p, body: e.target.value }))}
                  style={{ minHeight: 200, fontSize: 13 }}
                />
              </label>
            </div>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setEditStep(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => saveStep(editStep)}>Save Step</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ProspectingEngine ────────────────────────────────────────────────────
export default function ProspectingEngine({ onConvertToAccount }) {
  // sourceTab: 'all' | 'sales' | 'marketing'
  const [sourceTab, setSourceTab] = useState('all');
  // sub-tab when not in marketing mode
  const [tab, setTab]             = useState('prospects');
  const [stats, setStats]         = useState({});
  const [prospects, setProspects] = useState([]);
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterSegment, setFilterSegment] = useState('');
  const [filterStatus, setFilterStatus]   = useState('Active');
  const [showForm, setShowForm]     = useState(false);
  const [editProspect, setEditProspect] = useState(null);
  const [viewProspect, setViewProspect] = useState(null);

  const loadStats = async () => {
    try { setStats(await authFetch('/api/prospects/stats')); } catch (err) { console.error(err); }
  };

  const loadProspects = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)               params.set('search', search);
      if (filterSegment)        params.set('segment', filterSegment);
      if (filterStatus)         params.set('status', filterStatus);
      if (sourceTab === 'sales') params.set('source', 'Sales');
      setProspects(await authFetch(`/api/prospects?${params}`));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadSequences = async () => {
    try { setSequences(await authFetch('/api/sequences')); } catch (err) { console.error(err); }
  };

  useEffect(() => { loadStats(); loadSequences(); }, []);
  useEffect(() => {
    if (sourceTab !== 'marketing') loadProspects();
  }, [search, filterSegment, filterStatus, sourceTab]);

  const refresh = () => { loadProspects(); loadStats(); };

  const deleteProspect = async (id) => {
    if (!confirm('Delete this prospect?')) return;
    await authFetch(`/api/prospects/${id}`, { method: 'DELETE' });
    refresh();
  };

  const isMarketing = sourceTab === 'marketing';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Outbound Prospecting</h2>
        {!isMarketing && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add Prospect</button>
        )}
      </div>

      {/* Source tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
        {[
          { key: 'all',       label: 'All Prospects' },
          { key: 'sales',     label: 'Sales Prospects' },
          { key: 'marketing', label: 'Marketing Leads' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSourceTab(key)}
            style={{
              padding: '6px 16px', borderRadius: 6, border: '1px solid',
              borderColor: sourceTab === key ? 'var(--accent)' : 'var(--border)',
              background: sourceTab === key ? 'rgba(0,180,216,0.12)' : 'var(--surface2)',
              color: sourceTab === key ? 'var(--accent)' : 'var(--muted)',
              fontWeight: sourceTab === key ? 700 : 400,
              fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Marketing Leads mode */}
      {isMarketing && <MarketingLeadsPanel onConvertToAccount={onConvertToAccount} />}

      {/* Sales / All prospects mode */}
      {!isMarketing && (
        <>
          <StatsBar stats={stats} />

          {/* Sub-tabs */}
          <div className="vh-tabs" style={{ marginBottom: '1rem' }}>
            <button className={`vh-tab${tab === 'prospects' ? ' active' : ''}`} onClick={() => setTab('prospects')}>
              {sourceTab === 'sales' ? 'Sales Prospects' : 'All Prospects'}
            </button>
            <button className={`vh-tab${tab === 'sequences' ? ' active' : ''}`} onClick={() => setTab('sequences')}>
              Email Sequences
            </button>
          </div>

          {tab === 'prospects' && (
            <>
              <div className="toolbar">
                <input
                  className="search-input"
                  placeholder="Search name, company, email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <select value={filterSegment} onChange={e => setFilterSegment(e.target.value)}>
                  <option value="">All Segments</option>
                  {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">All Statuses</option>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>Loading…</div>
              ) : prospects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                  No prospects found. Add your first prospect to get started.
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th><th>Company</th><th>Segment</th><th>Sequence</th>
                        <th>Stage</th><th>Next Action</th><th>Status</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {prospects.map(p => (
                        <tr key={p.id} onClick={() => setViewProspect(p.id)}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</div>
                            {p.title && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.title}</div>}
                          </td>
                          <td>{p.company || '—'}</td>
                          <td>
                            {p.segment
                              ? <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' }}>{p.segment}</span>
                              : '—'
                            }
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {p.sequence_name || '—'}
                            {p.sequence_step > 0 && <> · Step {p.sequence_step}</>}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--muted)' }}>{p.sequence_stage || 'Not Started'}</td>
                          <td style={{ fontSize: 12, color: p.next_action_date && new Date(p.next_action_date) < new Date() ? 'var(--red)' : 'var(--text)' }}>
                            {fmtDate(p.next_action_date)}
                            {p.next_action && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.next_action}</div>}
                          </td>
                          <td>
                            <span className="badge" style={{ background: STATUS_COLORS[p.status] || '#4B5563' }}>{p.status}</span>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn-icon" title="Edit" onClick={() => setEditProspect(p)}>✏️</button>
                              <button className="btn-icon" title="Delete" style={{ opacity: 0.5 }} onClick={() => deleteProspect(p.id)}>🗑</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === 'sequences' && <SequencesTab />}
        </>
      )}

      {/* Modals (prospects mode) */}
      {(showForm || editProspect) && (
        <ProspectForm
          prospect={editProspect}
          sequences={sequences}
          onClose={() => { setShowForm(false); setEditProspect(null); }}
          onSaved={() => { setShowForm(false); setEditProspect(null); refresh(); }}
        />
      )}
      {viewProspect && (
        <ProspectDetail
          prospectId={viewProspect}
          sequences={sequences}
          onClose={() => setViewProspect(null)}
          onRefresh={refresh}
          onConvert={(accountId) => { setViewProspect(null); onConvertToAccount(accountId); }}
        />
      )}
    </div>
  );
}
