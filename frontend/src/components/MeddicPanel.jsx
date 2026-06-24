import { useState, useEffect } from 'react';
import { authFetch } from '../context/AuthContext';

const FIELDS = [
  { key: 'meddic_metrics',           letter: 'M', label: 'Metrics',          placeholder: 'What ROI or business outcome does the customer need to justify the purchase? Quantify it.' },
  { key: 'meddic_economic_buyer',    letter: 'E', label: 'Economic Buyer',    placeholder: 'Name, title, and what they care about most. Who writes the check?' },
  { key: 'meddic_decision_criteria', letter: 'D', label: 'Decision Criteria', placeholder: 'Technical and business criteria they are using to evaluate solutions. What do they need to see?' },
  { key: 'meddic_decision_process',  letter: 'D', label: 'Decision Process',  placeholder: 'Steps, stakeholders, and timeline to a signed contract. What are the gates?' },
  { key: 'meddic_identify_pain',     letter: 'I', label: 'Identify Pain',     placeholder: 'The specific problem Dolt solves for them — in their words. What happens if they don\'t fix it?' },
  { key: 'meddic_champion',          letter: 'C', label: 'Champion',          placeholder: 'Name, title, why they believe in Dolt, their internal influence and authority.' },
  { key: 'meddic_paper_process',     letter: 'P', label: 'Paper Process',     placeholder: 'Legal review, security review, procurement, contract signature steps. Who else touches the paper?' },
];

function scoreColor(score) {
  if (score >= 6) return 'var(--green)';
  if (score >= 3) return 'var(--amber)';
  return 'var(--red)';
}

export default function MeddicPanel({ deal, onClose, onSaved }) {
  const [form, setForm] = useState({
    meddic_metrics:           deal.meddic_metrics           || '',
    meddic_economic_buyer:    deal.meddic_economic_buyer    || '',
    meddic_decision_criteria: deal.meddic_decision_criteria || '',
    meddic_decision_process:  deal.meddic_decision_process  || '',
    meddic_identify_pain:     deal.meddic_identify_pain     || '',
    meddic_champion:          deal.meddic_champion          || '',
    meddic_paper_process:     deal.meddic_paper_process     || '',
  });
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState(null);

  const score = Object.values(form).filter(v => v && v.trim().length > 0).length;

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await authFetch(`/api/deals/${deal.id}/meddic`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      if (onSaved) onSaved(score);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0 }}>MEDDIC — {deal.deal_name}</h2>
            <span
              className="badge"
              style={{
                background: scoreColor(score),
                fontSize: 13, fontWeight: 700, padding: '3px 12px',
              }}
            >
              {score}/7
            </span>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: '1.25rem' }}>
          MEDDPIC qualification framework — fill in each section to score this deal.
          Score is auto-calculated from non-empty fields.
        </div>

        {error && <div className="error-banner">{error}</div>}
        {saved && <div className="info-banner">MEDDIC saved and committed to Dolt.</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {FIELDS.map(f => (
            <div key={f.key}>
              <label style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 6, background: form[f.key]?.trim() ? 'var(--accent)' : 'var(--surface2)',
                  border: `1px solid ${form[f.key]?.trim() ? 'var(--accent)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, color: form[f.key]?.trim() ? '#fff' : 'var(--muted)',
                  flexShrink: 0, transition: 'all 0.15s',
                }}>
                  {f.letter}
                </span>
                {f.label}
              </label>
              <textarea
                value={form[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={{ width: '100%', minHeight: 72, fontSize: 13, lineHeight: 1.5 }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: '1.25rem' }}>
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save MEDDIC'}
          </button>
        </div>
      </div>
    </div>
  );
}
