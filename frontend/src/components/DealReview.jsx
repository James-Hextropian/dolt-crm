import { useState, useEffect } from 'react';
import { authFetch } from '../context/AuthContext';

const STAGES = ['Prospecting','Qualification','Discovery','Demo','POC Planned','POC Active','Negotiation','Closed-Won','Closed-Lost','Post-Sale'];

function fmt(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function DealReview({ deal, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch(`/api/deals/${deal.id}`)
      .then(data => { setHistory(data.stage_history || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [deal.id]);

  const totalDays = (() => {
    if (!history.length) return null;
    const start = new Date(history[0].entered_at);
    const end   = history[history.length - 1].exited_at ? new Date(history[history.length - 1].exited_at) : new Date();
    return Math.floor((end - start) / 86400000);
  })();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Deal Review — {deal.deal_name}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => window.print()}>🖨 Print</button>
            <button className="btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 2 }}>Final Stage</div><strong>{deal.stage}</strong></div>
          <div><div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 2 }}>Deal Value</div><strong>{fmt(deal.deal_value)}</strong></div>
          <div><div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 2 }}>Total Cycle</div><strong>{totalDays != null ? `${totalDays} days` : '—'}</strong></div>
        </div>

        {deal.win_loss_reason && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>Win / Loss Analysis</div>
            <div style={{ fontSize: 14 }}>{deal.win_loss_reason}</div>
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
          Stage Timeline
        </div>

        {loading ? (
          <div style={{ color: 'var(--muted)' }}>Loading history…</div>
        ) : history.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>No stage history recorded.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {history.map((h, i) => {
              const entered = new Date(h.entered_at);
              const exited  = h.exited_at ? new Date(h.exited_at) : null;
              const days    = exited ? Math.floor((exited - entered) / 86400000) : null;
              return (
                <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)', marginTop: 4 }} />
                    {i < history.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border)', minHeight: 20, margin: '4px 0' }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{h.stage}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      Entered: {entered.toLocaleDateString()}
                      {exited ? ` · Exited: ${exited.toLocaleDateString()} · ${days}d` : ' · Current stage'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
