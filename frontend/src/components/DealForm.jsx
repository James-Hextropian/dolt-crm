import { useState, useEffect } from 'react';
import { authFetch } from '../context/AuthContext';

const STAGES = [
  'Prospecting','Qualification','Discovery','Demo',
  'POC Planned','POC Active','Negotiation',
  'Closed-Won','Closed-Lost','Post-Sale',
];
const PROBABILITIES = [10,25,50,75,90,100];
const CLOSED_STAGES = ['Closed-Won','Closed-Lost','Post-Sale'];

export default function DealForm({ deal, accountId, onClose, onSaved }) {
  const [form, setForm] = useState({
    deal_name:      deal?.deal_name || '',
    account_id:     deal?.account_id || accountId || '',
    stage:          deal?.stage || 'Prospecting',
    deal_value:     deal?.deal_value || '',
    close_date:     deal?.close_date ? deal.close_date.slice(0,10) : '',
    probability:    deal?.probability || 10,
    owner_id:       deal?.owner_id || '',
    win_loss_reason: deal?.win_loss_reason || '',
  });
  const [users, setUsers]     = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    authFetch('/api/users').then(setUsers).catch(() => {});
    if (!accountId) authFetch('/api/accounts').then(setAccounts).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const needsReason = CLOSED_STAGES.includes(form.stage);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (needsReason && !form.win_loss_reason.trim()) {
      setError('Win/loss reason is required when closing a deal.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const body = {
        ...form,
        deal_value: form.deal_value || null,
        close_date: form.close_date || null,
        owner_id:   form.owner_id   || null,
        account_id: form.account_id || accountId,
      };
      if (deal?.id) {
        await authFetch(`/api/deals/${deal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await authFetch('/api/deals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{deal ? 'Edit Deal' : 'New Deal'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="full-width">
              Deal Name *
              <input value={form.deal_name} onChange={e => set('deal_name', e.target.value)} required />
            </label>
            {!accountId && (
              <label className="full-width">
                Account *
                <select value={form.account_id} onChange={e => set('account_id', e.target.value)} required>
                  <option value="">— Select Account —</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.company_name}</option>)}
                </select>
              </label>
            )}
            <label>
              Stage
              <select value={form.stage} onChange={e => set('stage', e.target.value)}>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>
              Probability
              <select value={form.probability} onChange={e => set('probability', Number(e.target.value))}>
                {PROBABILITIES.map(p => <option key={p} value={p}>{p}%</option>)}
              </select>
            </label>
            <label>
              Deal Value ($)
              <input type="number" min="0" step="1000" value={form.deal_value} onChange={e => set('deal_value', e.target.value)} placeholder="0" />
            </label>
            <label>
              Expected Close Date
              <input type="date" value={form.close_date} onChange={e => set('close_date', e.target.value)} />
            </label>
            <label>
              Owner
              <select value={form.owner_id} onChange={e => set('owner_id', e.target.value)}>
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            {needsReason && (
              <label className="full-width">
                Win / Loss Reason *
                <textarea
                  value={form.win_loss_reason}
                  onChange={e => set('win_loss_reason', e.target.value)}
                  required={needsReason}
                  placeholder="Describe the outcome…"
                />
              </label>
            )}
          </div>
          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving…' : (deal ? 'Save Changes' : 'Create Deal')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
