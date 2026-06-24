import { useRef } from 'react';

function fmt(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function PreMeetingPrep({ account, contacts, deals, notes, onClose }) {
  const docRef = useRef(null);

  const handlePrint = () => window.print();

  const activeDeal = deals.find(d => !['Closed-Lost'].includes(d.stage)) || deals[0];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal prep-modal" style={{ maxWidth: 760, padding: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Pre-Meeting Prep — {account.company_name}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={handlePrint}>🖨 Print / PDF</button>
            <button className="btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="prep-doc" ref={docRef}>
          <div className="prep-header">
            <h1>{account.company_name}</h1>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              Pre-Meeting Brief · Generated {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="prep-section">
            <div className="prep-section-title">Company Info</div>
            <div className="prep-info-grid">
              <div className="prep-info-item"><div className="prep-info-label">Segment</div><div className="prep-info-value">{account.segment || '—'}</div></div>
              <div className="prep-info-item"><div className="prep-info-label">Website</div><div className="prep-info-value">{account.website || '—'}</div></div>
              <div className="prep-info-item"><div className="prep-info-label">Owner</div><div className="prep-info-value">{account.owner_name || '—'}</div></div>
              <div className="prep-info-item"><div className="prep-info-label">Last Contact</div><div className="prep-info-value">{account.last_contact_date ? new Date(account.last_contact_date).toLocaleDateString() : '—'}</div></div>
            </div>
          </div>

          {activeDeal && (
            <div className="prep-section">
              <div className="prep-section-title">Deal Status</div>
              <div className="prep-info-grid">
                <div className="prep-info-item"><div className="prep-info-label">Deal</div><div className="prep-info-value">{activeDeal.deal_name}</div></div>
                <div className="prep-info-item"><div className="prep-info-label">Stage</div><div className="prep-info-value">{activeDeal.stage}</div></div>
                <div className="prep-info-item"><div className="prep-info-label">Value</div><div className="prep-info-value">{fmt(activeDeal.deal_value)}</div></div>
                <div className="prep-info-item"><div className="prep-info-label">Probability</div><div className="prep-info-value">{activeDeal.probability}%</div></div>
                <div className="prep-info-item"><div className="prep-info-label">Close Date</div><div className="prep-info-value">{activeDeal.close_date ? new Date(activeDeal.close_date).toLocaleDateString() : '—'}</div></div>
                <div className="prep-info-item"><div className="prep-info-label">Days in Stage</div><div className="prep-info-value">{activeDeal.days_in_stage ?? '—'}</div></div>
              </div>
              {activeDeal.win_loss_reason && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>
                  <strong>Win/Loss:</strong> {activeDeal.win_loss_reason}
                </div>
              )}
            </div>
          )}

          <div className="prep-section">
            <div className="prep-section-title">Contacts ({contacts.length})</div>
            {contacts.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>No contacts.</p> : contacts.map(c => (
              <div key={c.id} className="prep-note-entry" style={{ marginBottom: 8, borderLeftColor: c.is_primary ? 'var(--accent)' : 'var(--border)' }}>
                <strong>{c.name}</strong>{c.title ? ` — ${c.title}` : ''}
                {c.email && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{c.email}{c.phone ? ` · ${c.phone}` : ''}</div>}
              </div>
            ))}
          </div>

          <div className="prep-section">
            <div className="prep-section-title">Notes Timeline ({notes.length})</div>
            {notes.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>No notes.</p> : notes.slice(0, 10).map(n => (
              <div key={n.id} className="prep-note-entry">
                <div className="prep-note-date">{new Date(n.created_at).toLocaleDateString()}{n.author_name ? ` · ${n.author_name}` : ''}</div>
                <div className="prep-note-body">{n.content}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
