import { useState, useEffect } from 'react';
import { authFetch } from '../context/AuthContext';

const SEGMENTS = ['Coding Agents','FSI / Banks','App Builders','Agents for X','EU AI Act','Other'];

export default function AccountForm({ account, onClose, onSaved }) {
  const [form, setForm] = useState({
    company_name: account?.company_name || '',
    website:      account?.website || '',
    segment:      account?.segment || '',
    owner_id:     account?.owner_id || '',
    last_contact_date: account?.last_contact_date ? account.last_contact_date.slice(0,10) : '',
  });
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    authFetch('/api/users').then(setUsers).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = { ...form, owner_id: form.owner_id || null };
      if (account?.id) {
        await authFetch(`/api/accounts/${account.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await authFetch('/api/accounts', {
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
          <h2>{account ? 'Edit Account' : 'New Account'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="full-width">
              Company Name *
              <input value={form.company_name} onChange={e => set('company_name', e.target.value)} required />
            </label>
            <label>
              Website
              <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://…" />
            </label>
            <label>
              Segment
              <select value={form.segment} onChange={e => set('segment', e.target.value)}>
                <option value="">— Select —</option>
                {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>
              Account Owner
              <select value={form.owner_id} onChange={e => set('owner_id', e.target.value)}>
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label>
              Last Contact Date
              <input type="date" value={form.last_contact_date} onChange={e => set('last_contact_date', e.target.value)} />
            </label>
          </div>
          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving…' : (account ? 'Save Changes' : 'Create Account')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
