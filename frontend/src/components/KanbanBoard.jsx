import { useState, useEffect } from 'react';
import { authFetch } from '../context/AuthContext';
import DealForm from './DealForm';

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

const SEGMENT_COLORS = {
  'Coding Agents': '#00B4D8',
  'FSI / Banks':   '#7B2FBE',
  'App Builders':  '#f0883e',
  'Agents for X':  '#48BB78',
  'EU AI Act':     '#d29922',
  'Other':         '#4B5563',
};

function fmt(n) {
  if (!n) return '';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function KanbanBoard({ onViewDetail }) {
  const [deals, setDeals]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [dragId, setDragId]       = useState(null);
  const [overStage, setOverStage] = useState(null);
  const [editDeal, setEditDeal]   = useState(null);
  const [showNew, setShowNew]     = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await authFetch('/api/deals');
      setDeals(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDragStart = (e, dealId) => {
    setDragId(dealId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e, stage) => {
    e.preventDefault();
    setOverStage(null);
    if (!dragId) return;
    const deal = deals.find(d => d.id === dragId);
    if (!deal || deal.stage === stage) { setDragId(null); return; }

    if (['Closed-Won','Closed-Lost','Post-Sale'].includes(stage)) {
      const reason = prompt(`Enter win/loss reason for moving to "${stage}":`);
      if (reason === null) { setDragId(null); return; }
      if (!reason.trim()) { alert('Win/loss reason is required.'); setDragId(null); return; }
      try {
        await authFetch(`/api/deals/${deal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...deal, stage, win_loss_reason: reason }),
        });
      } catch (err) { alert(err.message); }
    } else {
      try {
        await authFetch(`/api/deals/${deal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...deal, stage }),
        });
      } catch (err) { alert(err.message); }
    }

    setDragId(null);
    load();
  };

  const colDeals = (stage) => deals.filter(d => d.stage === stage);
  const colValue = (stage) => colDeals(stage).reduce((s, d) => s + Number(d.deal_value || 0), 0);

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Pipeline</h2>
        <button className="btn-primary" onClick={() => setShowNew(true)}>+ Add Deal</button>
      </div>

      <div className="kanban-board">
        {STAGES.map(stage => (
          <div
            key={stage}
            className={`kanban-column${overStage === stage ? ' over' : ''}`}
            onDragOver={e => { e.preventDefault(); setOverStage(stage); }}
            onDragLeave={() => setOverStage(null)}
            onDrop={e => handleDrop(e, stage)}
          >
            <div className="kanban-col-header">
              <span className="kanban-col-title" style={{ color: STAGE_COLORS[stage] }}>{stage}</span>
              <span className="kanban-col-count">{colDeals(stage).length}</span>
            </div>
            {colValue(stage) > 0 && (
              <div className="kanban-col-value">{fmt(colValue(stage))}</div>
            )}
            <div className="kanban-cards">
              {colDeals(stage).length === 0 ? (
                <div className="kanban-empty">Drop here</div>
              ) : colDeals(stage).map(deal => (
                <div
                  key={deal.id}
                  className="kanban-card"
                  draggable
                  onDragStart={e => handleDragStart(e, deal.id)}
                  style={{ borderLeftColor: SEGMENT_COLORS[deal.segment] || 'transparent' }}
                >
                  <button className="kanban-card-name" onClick={() => onViewDetail(deal.account_id)}>
                    {deal.deal_name}
                  </button>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>{deal.company_name}</div>
                  <div className="kanban-card-meta">
                    <span className="kanban-card-value">{fmt(deal.deal_value)}</span>
                    <span className="badge" style={{ background: 'var(--surface)', color: 'var(--muted)', fontSize: 10 }}>
                      {deal.probability}%
                    </span>
                  </div>
                  <div className="kanban-card-footer">
                    <span className="kanban-card-close">
                      {deal.close_date ? new Date(deal.close_date).toLocaleDateString(undefined, { month:'short', day:'numeric' }) : ''}
                    </span>
                    <span className="kanban-card-days">{deal.days_in_stage ?? 0}d</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span
                      title={`MEDDIC score: ${deal.meddic_score ?? 0}/7`}
                      style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 100,
                        background: (deal.meddic_score ?? 0) >= 6 ? 'var(--green)' : (deal.meddic_score ?? 0) >= 3 ? 'var(--amber)' : 'var(--surface)',
                        color: (deal.meddic_score ?? 0) > 0 ? '#fff' : 'var(--muted)',
                        border: `1px solid ${(deal.meddic_score ?? 0) > 0 ? 'transparent' : 'var(--border)'}`,
                      }}
                    >
                      M {deal.meddic_score ?? 0}/7
                    </span>
                    <button className="btn-icon" style={{ fontSize: 12 }} onClick={e => { e.stopPropagation(); setEditDeal(deal); }}>✏️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showNew && <DealForm onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
      {editDeal && <DealForm deal={editDeal} accountId={editDeal.account_id} onClose={() => setEditDeal(null)} onSaved={() => { setEditDeal(null); load(); }} />}
    </div>
  );
}
