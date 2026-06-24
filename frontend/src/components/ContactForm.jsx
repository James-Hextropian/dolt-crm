import { useState } from 'react';
import { authFetch } from '../context/AuthContext';

export default function ContactForm({ contact, accountId, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:       contact?.name  || '',
    title:      contact?.title || '',
    email:      contact?.email || '',
    phone:      contact?.phone || '',
    is_primary: contact?.is_primary ? true : false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (contact?.id) {
        await authFetch(`/api/contacts/${contact.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        await authFetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, account_id: accountId }),
        });
      }
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{contact ? 'Edit Contact' : 'Add Contact'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="full-width">
              Name *
              <input value={form.name} onChange={e => set('name', e.target.value)} required />
            </label>
            <label>
              Title
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="CEO, VP Sales…" />
            </label>
            <label>
              Email
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </label>
            <label>
              Phone
              <input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </label>
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="primary" checked={form.is_primary} onChange={e => set('is_primary', e.target.checked)}
                style={{ width: 15, height: 15, accentColor: 'var(--accent)' }} />
              <label htmlFor="primary" style={{ flexDirection: 'row', gap: 0, textTransform: 'none', letterSpacing: 'normal', fontWeight: 400, color: 'var(--text)' }}>
                Primary contact
              </label>
            </div>
          </div>
          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving…' : (contact ? 'Save' : 'Add Contact')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
