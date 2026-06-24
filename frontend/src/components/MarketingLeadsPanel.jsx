import { useState, useEffect, useRef } from 'react';
import { authFetch } from '../context/AuthContext';

// ── Constants ─────────────────────────────────────────────────────────────────
const SEGMENTS  = ['Coding Agents', 'FSI / Banks', 'App Builders', 'Agents for X', 'EU AI Act', 'Other'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const SOURCES   = ['LinkedIn', 'Website', 'Event', 'Webinar', 'Referral', 'Content', 'Cold Outreach', 'Partner', 'Other'];
const STATUSES  = ['New', 'Contacted', 'Qualified', 'Converted', 'Disqualified'];
const DATE_RANGES = [{ value: '', label: 'All Time' }, { value: '7d', label: 'Last 7 Days' }, { value: '30d', label: 'Last 30 Days' }];

const CSV_HEADERS = 'first_name,last_name,title,company,email,linkedin_url,segment,priority,source,notes';

const PRIORITY_COLORS = { High: '#f85149', Medium: '#d29922', Low: '#4B5563' };
const STATUS_COLORS   = { New: '#00B4D8', Contacted: '#7B2FBE', Qualified: '#48BB78', Converted: '#2BAC76', Disqualified: '#4B5563' };

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── CSV helpers ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).map((line, idx) => {
    const values = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { values.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    values.push(cur.trim());
    const obj = Object.fromEntries(headers.map((h, i) => [h, values[i] || '']));
    obj._row = idx + 2;
    return obj;
  });
}

function toCSV(leads) {
  const cols = ['first_name','last_name','title','company','email','segment','priority','source','status','created_at'];
  const header = cols.join(',');
  const rows = leads.map(l =>
    cols.map(c => `"${(l[c] || '').toString().replace(/"/g, '""')}"`).join(',')
  );
  return [header, ...rows].join('\n');
}

function downloadText(text, filename, mime = 'text/csv') {
  const blob = new Blob([text], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 500,
      background: 'var(--surface)', border: '1px solid var(--accent)',
      color: 'var(--accent)', borderRadius: 10, padding: '12px 20px',
      fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      maxWidth: 360,
    }}>
      {message}
    </div>
  );
}

// ── Lead Form (create / edit) ─────────────────────────────────────────────────
function LeadForm({ lead, users, onClose, onSaved }) {
  const blank = { first_name:'', last_name:'', title:'', company:'', email:'',
    linkedin_url:'', segment:'', priority:'Medium', source:'', notes:'', assigned_to:'' };
  const [form, setForm] = useState(lead ? {
    first_name:   lead.first_name   || '',
    last_name:    lead.last_name    || '',
    title:        lead.title        || '',
    company:      lead.company      || '',
    email:        lead.email        || '',
    linkedin_url: lead.linkedin_url || '',
    segment:      lead.segment      || '',
    priority:     lead.priority     || 'Medium',
    source:       lead.source       || '',
    notes:        lead.notes        || '',
    assigned_to:  lead.assigned_to  ? String(lead.assigned_to) : '',
    status:       lead.status       || 'New',
  } : blank);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.first_name.trim() && !form.last_name.trim()) {
      setError('First or last name is required'); return;
    }
    if (!form.company.trim()) { setError('Company is required'); return; }
    setSaving(true); setError(null);
    try {
      const method = lead ? 'PUT' : 'POST';
      const url    = lead ? `/api/marketing-leads/${lead.id}` : '/api/marketing-leads';
      const body   = { ...form, assigned_to: form.assigned_to ? Number(form.assigned_to) : null };
      await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{lead ? 'Edit Lead' : 'Add Marketing Lead'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <div className="form-grid">
          <label>First Name<input value={form.first_name} onChange={e => set('first_name', e.target.value)} /></label>
          <label>Last Name<input value={form.last_name} onChange={e => set('last_name', e.target.value)} /></label>
          <label>Title<input value={form.title} onChange={e => set('title', e.target.value)} /></label>
          <label>Company *<input value={form.company} onChange={e => set('company', e.target.value)} /></label>
          <label>Email<input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></label>
          <label>LinkedIn URL<input value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} /></label>
          <label>Segment
            <select value={form.segment} onChange={e => set('segment', e.target.value)}>
              <option value="">— Select —</option>
              {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>Priority
            <select value={form.priority} onChange={e => set('priority', e.target.value)}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label>Source
            <select value={form.source} onChange={e => set('source', e.target.value)}>
              <option value="">— Select —</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>Status
            <select value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {users.length > 0 && (
            <label>Assign To
              <select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
          )}
          <label className="full-width">Notes
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} />
          </label>
        </div>
        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Lead'}</button>
        </div>
      </div>
    </div>
  );
}

// ── CSV Import Modal ───────────────────────────────────────────────────────────
function ImportModal({ onClose, onImported }) {
  const [rows, setRows]         = useState([]);
  const [fileName, setFileName] = useState('');
  const [batchName, setBatchName] = useState('');
  const [defPriority, setDefPriority] = useState('Medium');
  const [defSource, setDefSource]     = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCSV(e.target.result);
      setRows(parsed);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  };

  const doImport = async () => {
    setImporting(true); setError(null);
    try {
      const res = await authFetch('/api/marketing-leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: rows,
          import_batch: batchName || null,
          default_priority: defPriority,
          default_source: defSource || null,
        }),
      });
      setResult(res);
      if (res.imported > 0) onImported();
    } catch (err) { setError(err.message); }
    finally { setImporting(false); }
  };

  const PREVIEW_COLS = ['first_name','last_name','title','company','email','segment','priority','source'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import CSV</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {error && <div className="error-banner">{error}</div>}
        {result && (
          <div className={result.imported > 0 ? 'info-banner' : 'error-banner'} style={{ marginBottom: '1rem' }}>
            {result.imported} leads imported{result.skipped > 0 ? `, ${result.skipped} skipped (missing required fields)` : '.'}{' '}
            {result.errors?.length > 0 && <span style={{ fontSize: 12 }}>Errors: {result.errors.map(e => `Row ${e.row}: ${e.reason}`).join('; ')}</span>}
          </div>
        )}

        {/* Drop zone */}
        {rows.length === 0 && (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current.click()}
            style={{
              border: '2px dashed var(--border)', borderRadius: 10,
              padding: '3rem', textAlign: 'center', cursor: 'pointer',
              marginBottom: '1rem', transition: 'border-color 0.15s',
            }}
            onDragEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onDragLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
            <div style={{ fontWeight: 600 }}>Drop CSV here or click to browse</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
              Expected columns: <code style={{ fontSize: 11 }}>{CSV_HEADERS}</code>
            </div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])} />
          </div>
        )}

        {rows.length === 0 && (
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <button className="btn-secondary" style={{ fontSize: 12 }}
              onClick={() => downloadText(CSV_HEADERS + '\n', 'marketing_leads_template.csv')}>
              Download Template CSV
            </button>
          </div>
        )}

        {/* File loaded — settings + preview */}
        {rows.length > 0 && (
          <>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: '1rem' }}>
              <strong style={{ color: 'var(--text)' }}>{fileName}</strong> — {rows.length} rows detected
              <button className="btn-icon" style={{ marginLeft: 8, fontSize: 11 }} onClick={() => { setRows([]); setFileName(''); setResult(null); }}>
                ✕ Clear
              </button>
            </div>

            <div className="form-grid" style={{ marginBottom: '1rem' }}>
              <label>Batch Name
                <input value={batchName} onChange={e => setBatchName(e.target.value)}
                  placeholder="e.g. June 2026 LinkedIn Campaign" />
              </label>
              <label>Default Priority
                <select value={defPriority} onChange={e => setDefPriority(e.target.value)}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="full-width">Default Source (used when row has no source)
                <select value={defSource} onChange={e => setDefSource(e.target.value)}>
                  <option value="">— None —</option>
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>

            {/* Preview table */}
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Preview (first 5 rows)
            </div>
            <div style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
              <table className="data-table" style={{ fontSize: 11 }}>
                <thead>
                  <tr>{PREVIEW_COLS.map(c => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      {PREVIEW_COLS.map(c => <td key={c}>{r[c] || '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>{result ? 'Close' : 'Cancel'}</button>
          {rows.length > 0 && !result && (
            <button className="btn-primary" onClick={doImport} disabled={importing}>
              {importing ? 'Importing…' : `Import ${rows.length} Leads`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Bulk action bar ────────────────────────────────────────────────────────────
function BulkActionBar({ count, users, onAssign, onPriority, onStatus, onConvert, onDelete, onClear }) {
  const [showAssign, setShowAssign]     = useState(false);
  const [showPriority, setShowPriority] = useState(false);
  const [showStatus, setShowStatus]     = useState(false);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      background: 'rgba(0,180,216,0.08)', border: '1px solid rgba(0,180,216,0.3)',
      borderRadius: 8, padding: '10px 14px', marginBottom: '1rem',
    }}>
      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{count} selected</span>

      {/* Assign */}
      <div style={{ position: 'relative' }}>
        <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setShowAssign(p => !p)}>
          Assign to Rep ▾
        </button>
        {showAssign && users.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 300, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, minWidth: 160, marginTop: 4 }}>
            {users.map(u => (
              <button key={u.id} className="user-dropdown-item" onClick={() => { onAssign(u.id); setShowAssign(false); }}>
                {u.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Priority */}
      <div style={{ position: 'relative' }}>
        <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setShowPriority(p => !p)}>
          Set Priority ▾
        </button>
        {showPriority && (
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 300, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, minWidth: 140, marginTop: 4 }}>
            {PRIORITIES.map(p => (
              <button key={p} className="user-dropdown-item" onClick={() => { onPriority(p); setShowPriority(false); }}>
                <span className="badge" style={{ background: PRIORITY_COLORS[p], marginRight: 6 }}>{p}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Status */}
      <div style={{ position: 'relative' }}>
        <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setShowStatus(p => !p)}>
          Set Status ▾
        </button>
        {showStatus && (
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 300, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, minWidth: 160, marginTop: 4 }}>
            {STATUSES.map(s => (
              <button key={s} className="user-dropdown-item" onClick={() => { onStatus(s); setShowStatus(false); }}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="btn-secondary" style={{ fontSize: 12 }} onClick={onConvert}>
        Convert to Prospects
      </button>
      <button className="btn-secondary" style={{ fontSize: 12, color: 'var(--red)', borderColor: 'rgba(248,81,73,0.3)' }} onClick={onDelete}>
        Delete
      </button>
      <button className="btn-icon" style={{ marginLeft: 'auto' }} onClick={onClear}>✕ Clear</button>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────
export default function MarketingLeadsPanel({ onConvertToAccount }) {
  const [leads, setLeads]         = useState([]);
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(new Set());
  const [toast, setToast]         = useState(null);

  // Filters
  const [search, setSearch]         = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterSegment, setFilterSegment]   = useState('');
  const [filterStatus, setFilterStatus]     = useState('');
  const [filterDate, setFilterDate]         = useState('');

  // Modals
  const [showForm, setShowForm]       = useState(false);
  const [editLead, setEditLead]       = useState(null);
  const [showImport, setShowImport]   = useState(false);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)         params.set('search', search);
      if (filterPriority) params.set('priority', filterPriority);
      if (filterSegment)  params.set('segment', filterSegment);
      if (filterStatus)   params.set('status', filterStatus);
      if (filterDate)     params.set('date_range', filterDate);
      const data = await authFetch(`/api/marketing-leads?${params}`);
      setLeads(data);
      setSelected(new Set());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadUsers = async () => {
    try { setUsers(await authFetch('/api/users')); } catch { /* non-admin silently fails */ }
  };

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { loadLeads(); }, [search, filterPriority, filterSegment, filterStatus, filterDate]);

  const showToast = (msg) => setToast(msg);

  const deleteLead = async (id) => {
    if (!confirm('Delete this lead?')) return;
    await authFetch(`/api/marketing-leads/${id}`, { method: 'DELETE' });
    loadLeads();
  };

  const convertLead = async (lead) => {
    try {
      const res = await authFetch(`/api/marketing-leads/${lead.id}/convert`, { method: 'POST' });
      showToast(`${lead.first_name || lead.company} converted to prospect.`);
      loadLeads();
      return res.prospect_id;
    } catch (err) { alert(err.message); return null; }
  };

  // Selection helpers
  const toggleAll = () => {
    if (selected.size === leads.length) { setSelected(new Set()); }
    else { setSelected(new Set(leads.map(l => l.id))); }
  };
  const toggleOne = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  // Bulk operations — loop over selected IDs
  const bulkUpdate = async (patch) => {
    const ids = [...selected];
    await Promise.all(ids.map(id => {
      const lead = leads.find(l => l.id === id);
      if (!lead) return;
      return authFetch(`/api/marketing-leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lead, ...patch }),
      });
    }));
    loadLeads();
  };

  const bulkConvert = async () => {
    if (!confirm(`Convert ${selected.size} leads to prospects?`)) return;
    const ids = [...selected];
    let ok = 0;
    for (const id of ids) {
      try {
        await authFetch(`/api/marketing-leads/${id}/convert`, { method: 'POST' });
        ok++;
      } catch { /* continue */ }
    }
    showToast(`${ok} leads converted to prospects.`);
    loadLeads();
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} leads?`)) return;
    await Promise.all([...selected].map(id =>
      authFetch(`/api/marketing-leads/${id}`, { method: 'DELETE' })
    ));
    loadLeads();
  };

  const exportCSV = () => {
    downloadText(toCSV(leads), `marketing_leads_export_${new Date().toISOString().slice(0,10)}.csv`);
  };

  const allChecked = leads.length > 0 && selected.size === leads.length;
  const someChecked = selected.size > 0 && selected.size < leads.length;

  return (
    <div>
      {/* Top bar */}
      <div className="toolbar" style={{ marginBottom: '0.75rem' }}>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add Lead</button>
        <button className="btn-secondary" onClick={() => setShowImport(true)}>Import CSV</button>
        <input
          className="search-input"
          placeholder="Search name, company, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterSegment} onChange={e => setFilterSegment(e.target.value)}>
          <option value="">All Segments</option>
          {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterDate} onChange={e => setFilterDate(e.target.value)}>
          {DATE_RANGES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <button className="btn-secondary" style={{ marginLeft: 'auto' }} onClick={exportCSV}>Export CSV</button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          users={users}
          onAssign={(uid) => bulkUpdate({ assigned_to: uid })}
          onPriority={(p) => bulkUpdate({ priority: p })}
          onStatus={(s) => bulkUpdate({ status: s })}
          onConvert={bulkConvert}
          onDelete={bulkDelete}
          onClear={() => setSelected(new Set())}
        />
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>Loading…</div>
      ) : leads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
          No marketing leads yet. Add a lead or import a CSV to get started.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36, padding: '10px 8px' }}>
                  <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked; }}
                    onChange={toggleAll} style={{ cursor: 'pointer', width: 14, height: 14 }} />
                </th>
                <th>Name</th>
                <th>Title</th>
                <th>Company</th>
                <th>Segment</th>
                <th>Priority</th>
                <th>Source</th>
                <th>Status</th>
                <th>Date Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id} style={{ background: selected.has(lead.id) ? 'rgba(0,180,216,0.05)' : undefined }}>
                  <td style={{ padding: '8px' }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleOne(lead.id)}
                      style={{ cursor: 'pointer', width: 14, height: 14 }} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {lead.first_name || lead.last_name ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() : '—'}
                    </div>
                    {lead.email && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{lead.email}</div>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{lead.title || '—'}</td>
                  <td style={{ fontWeight: 500 }}>{lead.company || '—'}</td>
                  <td>
                    {lead.segment
                      ? <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 10 }}>{lead.segment}</span>
                      : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                    }
                  </td>
                  <td>
                    <span className="badge" style={{ background: PRIORITY_COLORS[lead.priority] || '#4B5563' }}>
                      {lead.priority || 'Medium'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{lead.source || '—'}</td>
                  <td>
                    <span className="badge" style={{ background: STATUS_COLORS[lead.status] || '#4B5563' }}>
                      {lead.status || 'New'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtDate(lead.created_at)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button className="btn-icon" title="Edit" onClick={() => setEditLead(lead)}>✏️</button>
                      {lead.status !== 'Converted' && (
                        <button className="btn-icon" title="Convert to Prospect" onClick={async () => {
                          const pid = await convertLead(lead);
                          // no navigation needed — toast is enough
                        }}>→</button>
                      )}
                      <button className="btn-icon" title="Delete" style={{ opacity: 0.5 }} onClick={() => deleteLead(lead.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {(showForm || editLead) && (
        <LeadForm
          lead={editLead}
          users={users}
          onClose={() => { setShowForm(false); setEditLead(null); }}
          onSaved={() => { setShowForm(false); setEditLead(null); loadLeads(); }}
        />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => loadLeads()}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
