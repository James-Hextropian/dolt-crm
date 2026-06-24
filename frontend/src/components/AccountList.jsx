import { useState, useEffect } from 'react';
import { authFetch } from '../context/AuthContext';
import AccountForm from './AccountForm';

const SEGMENTS = ['Coding Agents','FSI / Banks','App Builders','Agents for X','EU AI Act','Other'];

const STAGE_COLORS = {
  'Prospecting':   '#4B5563',
  'Qualification': '#5B21B6',
  'Discovery':     '#7C3AED',
  'Demo':          '#8B5CF6',
  'POC Planned':   '#A855F7',
  'POC Active':    '#C026D3',
  'Negotiation':   '#00B4D8',
  'Closed-Won':    '#48BB78',
  'Closed-Lost':   '#f85149',
  'Post-Sale':     '#2BAC76',
};

const SEGMENT_COLORS = {
  'Coding Agents': '#00B4D8',
  'FSI / Banks':   '#7B2FBE',
  'App Builders':  '#f0883e',
  'Agents for X':  '#48BB78',
  'EU AI Act':     '#d29922',
  'Other':         '#4B5563',
};

function fmt(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function AccountList({ onViewDetail }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [segment, setSegment]   = useState('');
  const [mine, setMine]         = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)  params.set('search', search);
      if (segment) params.set('segment', segment);
      if (mine)    params.set('mine', 'true');
      const data = await authFetch(`/api/accounts?${params}`);
      setAccounts(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, segment, mine]);

  return (
    <div>
      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search accounts…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={segment} onChange={e => setSegment(e.target.value)}>
          <option value="">All Segments</option>
          {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          className="btn-secondary"
          style={{ background: mine ? 'var(--accent)' : undefined, color: mine ? '#fff' : undefined, borderColor: mine ? 'var(--accent)' : undefined }}
          onClick={() => setMine(v => !v)}>
          My Accounts
        </button>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add Account</button>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Segment</th>
                <th>Stage</th>
                <th>Deal Value</th>
                <th>Contacts</th>
                <th>Owner</th>
                <th>Last Contact</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>No accounts found</td></tr>
              ) : accounts.map(a => (
                <tr key={a.id} onClick={() => onViewDetail(a.id)}>
                  <td>
                    <button className="company-link" onClick={e => { e.stopPropagation(); onViewDetail(a.id); }}>
                      {a.company_name}
                    </button>
                  </td>
                  <td>
                    {a.segment && (
                      <span className="badge" style={{ background: SEGMENT_COLORS[a.segment] || '#4B5563' }}>
                        {a.segment}
                      </span>
                    )}
                  </td>
                  <td>
                    {a.current_stage && (
                      <span className="badge" style={{ background: STAGE_COLORS[a.current_stage] || '#4B5563' }}>
                        {a.current_stage}
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{fmt(a.deal_value)}</td>
                  <td style={{ color: 'var(--muted)' }}>{a.contact_count || 0}</td>
                  <td style={{ color: 'var(--muted)' }}>{a.owner_name || '—'}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {a.last_contact_date ? new Date(a.last_contact_date).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <AccountForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}
