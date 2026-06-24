import { useState, useEffect } from 'react';
import { useAuth, authFetch } from '../context/AuthContext';

const STAGES = [
  'Prospecting','Qualification','Discovery','Demo',
  'POC Planned','POC Active','Negotiation',
  'Closed-Won','Closed-Lost','Post-Sale',
];

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

function fmt(n) {
  if (!n) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function Dashboard({ onViewAccount }) {
  const { user } = useAuth();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers]     = useState([]);
  // 'all' | 'mine' — controls the My/All toggle
  const [filterMode, setFilterMode] = useState('all');
  // '' = no rep override, or a userId string
  const [repFilter, setRepFilter]   = useState('');

  // The single userId passed to the API — rep selection wins over My/All toggle
  const effectiveUserId = repFilter
    ? repFilter
    : filterMode === 'mine' ? String(user.id) : '';

  const load = async (userId) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userId) params.set('assignedTo', userId);
      setData(await authFetch(`/api/deals/dashboard?${params}`));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // Fetch users for the rep dropdown (silently fails for non-admins)
  useEffect(() => {
    authFetch('/api/users').then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    load(effectiveUserId);
  }, [effectiveUserId]);

  const handleModeChange = (mode) => {
    setRepFilter('');       // clear any rep override
    setFilterMode(mode);
  };

  const handleRepChange = (e) => {
    setRepFilter(e.target.value);
    if (e.target.value) setFilterMode('all'); // toggle becomes irrelevant when a rep is pinned
  };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>;
  if (!data) return null;

  const { by_stage = [], closing_this_month, win_rate, closed_won_accounts, total_pipeline } = data;

  const activePipeline = by_stage.filter(r => !['Closed-Lost','Closed-Won'].includes(r.stage));
  const totalActive = activePipeline.reduce((s, r) => s + Number(r.total_value || 0), 0);
  const won  = Number(win_rate?.won  || 0);
  const lost = Number(win_rate?.lost || 0);
  const wr   = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
  const logoTarget = 6;
  const logoCount  = Number(closed_won_accounts || 0);
  const arrTarget  = 1_000_000;

  // Toggle active states — both go dark when a specific rep is pinned
  const allActive  = !repFilter && filterMode === 'all';
  const mineActive = !repFilter && filterMode === 'mine';

  const btnStyle = (active) => ({
    padding: '5px 14px', borderRadius: 6, border: 'none',
    cursor: 'pointer', fontSize: 13, fontWeight: 500,
    background: active ? 'var(--accent)' : 'transparent',
    color:      active ? '#fff'          : 'var(--muted)',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header + filter controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Dashboard</h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* My / All toggle */}
          <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 8, padding: 3 }}>
            <button style={btnStyle(allActive)}  onClick={() => handleModeChange('all')}>All Deals</button>
            <button style={btnStyle(mineActive)} onClick={() => handleModeChange('mine')}>My Deals</button>
          </div>

          {/* Rep filter — only shown when the users list is accessible */}
          {users.length > 0 && (
            <select
              value={repFilter}
              onChange={handleRepChange}
              style={{ fontSize: 13, minWidth: 140 }}
            >
              <option value="">All Reps</option>
              {users.map(u => (
                <option key={u.id} value={String(u.id)}>{u.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-label">Total Pipeline</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{fmt(total_pipeline)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Closing This Month</div>
          <div className="stat-value">{closing_this_month?.n || 0}</div>
          <div className="stat-sub">{fmt(closing_this_month?.v)} at risk</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Win Rate (90d)</div>
          <div className="stat-value">{wr}%</div>
          <div className="stat-sub">{won} won / {lost} lost</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Logos Closed</div>
          <div className="stat-value">{logoCount} <span style={{ fontSize: 14, color: 'var(--muted)' }}>/ {logoTarget}</span></div>
        </div>
      </div>

      {/* Targets */}
      <div className="dash-grid">
        <div className="dash-card">
          <h3>$1M ARR Target</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span>{fmt(totalActive)} pipeline</span>
            <span style={{ color: 'var(--muted)' }}>{Math.min(100, Math.round((totalActive / arrTarget) * 100))}%</span>
          </div>
          <div className="progress-wrap">
            <div className="progress-bar" style={{ width: `${Math.min(100, (totalActive / arrTarget) * 100)}%` }} />
          </div>
        </div>

        <div className="dash-card">
          <h3>6 Logo Target</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span>{logoCount} accounts closed</span>
            <span style={{ color: 'var(--muted)' }}>{Math.min(100, Math.round((logoCount / logoTarget) * 100))}%</span>
          </div>
          <div className="progress-wrap">
            <div className="progress-bar" style={{ width: `${Math.min(100, (logoCount / logoTarget) * 100)}%`, background: 'var(--dolt-green)' }} />
          </div>
        </div>
      </div>

      {/* Pipeline by stage */}
      <div className="dash-card">
        <h3>Pipeline by Stage</h3>
        <table className="dash-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Stage</th>
              <th style={{ textAlign: 'right' }}>Deals</th>
              <th style={{ textAlign: 'right' }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {STAGES.map(stage => {
              const row = by_stage.find(r => r.stage === stage);
              if (!row) return null;
              return (
                <tr key={stage}>
                  <td>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: STAGE_COLORS[stage], marginRight: 8 }} />
                    {stage}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{row.deal_count}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(row.total_value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
