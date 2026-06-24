import { useState, useEffect } from 'react';
import { authFetch } from '../context/AuthContext';
import AccountForm from './AccountForm';
import ContactForm from './ContactForm';
import DealForm from './DealForm';
import DocumentManager from './DocumentManager';
import PreMeetingPrep from './PreMeetingPrep';
import DealReview from './DealReview';
import MeddicPanel from './MeddicPanel';

const SEGMENT_COLORS = {
  'Coding Agents': '#00B4D8',
  'FSI / Banks':   '#7B2FBE',
  'App Builders':  '#f0883e',
  'Agents for X':  '#48BB78',
  'EU AI Act':     '#d29922',
  'Other':         '#4B5563',
};
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

function relativeTime(d) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function fmt(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function AccountDetail({ accountId, onBack }) {
  const [account, setAccount]     = useState(null);
  const [contacts, setContacts]   = useState([]);
  const [deals, setDeals]         = useState([]);
  const [notes, setNotes]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [noteText, setNoteText]   = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [editAccount, setEditAccount] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editDeal, setEditDeal]   = useState(null);
  const [showDealForm, setShowDealForm] = useState(false);
  const [showPrep, setShowPrep]   = useState(false);
  const [showReview, setShowReview] = useState(null);
  const [showMeddic, setShowMeddic] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [acct, ctcts, dls, nts] = await Promise.all([
        authFetch(`/api/accounts/${accountId}`),
        authFetch(`/api/contacts?account_id=${accountId}`),
        authFetch(`/api/deals?account_id=${accountId}`).catch(() => []),
        authFetch(`/api/accounts/${accountId}/notes`),
      ]);
      setAccount(acct);
      setContacts(ctcts);
      setDeals(dls || []);
      setNotes(nts);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [accountId]);

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await authFetch(`/api/accounts/${accountId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteText.trim() }),
      });
      setNoteText('');
      const nts = await authFetch(`/api/accounts/${accountId}/notes`);
      setNotes(nts);
    } catch (err) { alert(err.message); }
    finally { setSavingNote(false); }
  };

  const deleteNote = async (id) => {
    if (!confirm('Delete this note?')) return;
    await authFetch(`/api/accounts/${accountId}/notes/${id}`, { method: 'DELETE' });
    setNotes(n => n.filter(x => x.id !== id));
  };

  const deleteContact = async (id) => {
    if (!confirm('Delete this contact?')) return;
    await authFetch(`/api/contacts/${id}`, { method: 'DELETE' });
    setContacts(c => c.filter(x => x.id !== id));
  };

  const deleteDeal = async (id) => {
    if (!confirm('Delete this deal?')) return;
    await authFetch(`/api/deals/${id}`, { method: 'DELETE' });
    setDeals(d => d.filter(x => x.id !== id));
  };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>;
  if (!account) return <div style={{ padding: '2rem' }}>Account not found.</div>;

  return (
    <div className="account-detail">
      {/* Back + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <button className="btn-secondary" onClick={onBack}>← Back to Accounts</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setShowPrep(true)}>📄 Pre-Meeting Prep</button>
          <button className="btn-primary" onClick={() => setEditAccount(true)}>Edit Account</button>
        </div>
      </div>

      {/* Account info */}
      <div className="detail-section">
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>{account.company_name}</h1>
            {account.segment && (
              <span className="badge" style={{ background: SEGMENT_COLORS[account.segment] || '#4B5563' }}>
                {account.segment}
              </span>
            )}
          </div>
        </div>
        <div className="account-info-grid">
          <div className="info-item">
            <div className="info-label">Website</div>
            <div className="info-value">
              {account.website ? <a href={account.website} target="_blank" rel="noreferrer">{account.website}</a> : '—'}
            </div>
          </div>
          <div className="info-item">
            <div className="info-label">Owner</div>
            <div className="info-value">{account.owner_name || '—'}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Last Contact</div>
            <div className="info-value">
              {account.last_contact_date ? new Date(account.last_contact_date).toLocaleDateString() : '—'}
            </div>
          </div>
          <div className="info-item">
            <div className="info-label">Created</div>
            <div className="info-value">{new Date(account.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {/* Deals */}
      <div className="detail-section">
        <div className="section-header">
          <div className="section-title">Deals</div>
          <button className="btn-primary" onClick={() => setShowDealForm(true)}>+ Add Deal</button>
        </div>
        {deals.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>No deals yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Deal</th><th>Stage</th><th>Value</th><th>Probability</th>
                <th>Close Date</th><th>Days in Stage</th><th>MEDDIC</th><th></th>
              </tr>
            </thead>
            <tbody>
              {deals.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>{d.deal_name}</td>
                  <td>
                    <span className="badge" style={{ background: STAGE_COLORS[d.stage] || '#4B5563' }}>
                      {d.stage}
                    </span>
                  </td>
                  <td>{fmt(d.deal_value)}</td>
                  <td>{d.probability}%</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {d.close_date ? new Date(d.close_date).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{d.days_in_stage ?? 0}d</td>
                  <td>
                    <button
                      className="meddic-score-badge"
                      title="MEDDIC Qualification"
                      onClick={e => { e.stopPropagation(); setShowMeddic(d); }}
                      style={{
                        background: d.meddic_score >= 6 ? 'var(--green)' : d.meddic_score >= 3 ? 'var(--amber)' : 'var(--surface2)',
                        color: d.meddic_score > 0 ? '#fff' : 'var(--muted)',
                        border: `1px solid ${d.meddic_score >= 6 ? 'var(--green)' : d.meddic_score >= 3 ? 'var(--amber)' : 'var(--border)'}`,
                      }}
                    >
                      {d.meddic_score ?? 0}/7
                    </button>
                  </td>
                  <td style={{ display: 'flex', gap: 4, cursor: 'default' }} onClick={e => e.stopPropagation()}>
                    <button className="btn-icon" title="Edit" onClick={() => setEditDeal(d)}>✏️</button>
                    {['Closed-Won','Closed-Lost','Post-Sale'].includes(d.stage) && (
                      <button className="btn-icon" title="Deal Review" onClick={() => setShowReview(d)}>📋</button>
                    )}
                    <button className="btn-icon" title="Delete" onClick={() => deleteDeal(d.id)}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Contacts */}
      <div className="detail-section">
        <div className="section-header">
          <div className="section-title">Contacts</div>
          <button className="btn-primary" onClick={() => setShowContactForm(true)}>+ Add Contact</button>
        </div>
        {contacts.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>No contacts yet.</div>
        ) : (
          <div className="contacts-grid">
            {contacts.map(c => (
              <div key={c.id} className={`contact-card${c.is_primary ? ' primary' : ''}`}>
                {c.is_primary && <span className="primary-badge">Primary</span>}
                <div className="contact-name">{c.name}</div>
                {c.title && <div className="contact-title">{c.title}</div>}
                {c.email && <div className="contact-detail"><a className="contact-link" href={`mailto:${c.email}`}>{c.email}</a></div>}
                {c.phone && <div className="contact-detail" style={{ color: 'var(--muted)' }}>{c.phone}</div>}
                <div className="contact-actions">
                  <button className="btn-icon" onClick={() => setEditContact(c)}>✏️ Edit</button>
                  <button className="btn-icon" style={{ color: 'var(--red)', opacity: 1 }} onClick={() => deleteContact(c.id)}>✕ Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="detail-section">
        <div className="section-header">
          <div className="section-title">Notes</div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <textarea
            style={{ width: '100%', minHeight: 80, marginBottom: 8 }}
            placeholder="Add a note…"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(); }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={addNote} disabled={savingNote || !noteText.trim()}>
              {savingNote ? 'Saving…' : 'Add Note'}
            </button>
          </div>
        </div>
        <div className="notes-list">
          {notes.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>No notes yet.</div>
          ) : notes.map(n => (
            <div key={n.id} className="note-card">
              <div className="note-body">{n.content}</div>
              <div className="note-footer">
                <span className="note-timestamp">
                  {relativeTime(n.created_at)} {n.author_name ? `· ${n.author_name}` : ''}
                </span>
                <div className="note-actions">
                  <button className="btn-icon" onClick={() => deleteNote(n.id)}>✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Documents */}
      <div className="detail-section">
        <div className="section-header">
          <div className="section-title">Documents</div>
        </div>
        <DocumentManager accountId={accountId} />
      </div>

      {/* Modals */}
      {editAccount && (
        <AccountForm account={account} onClose={() => setEditAccount(false)} onSaved={() => { setEditAccount(false); load(); }} />
      )}
      {(showContactForm || editContact) && (
        <ContactForm
          contact={editContact}
          accountId={accountId}
          onClose={() => { setShowContactForm(false); setEditContact(null); }}
          onSaved={() => { setShowContactForm(false); setEditContact(null); load(); }}
        />
      )}
      {(showDealForm || editDeal) && (
        <DealForm
          deal={editDeal}
          accountId={accountId}
          onClose={() => { setShowDealForm(false); setEditDeal(null); }}
          onSaved={() => { setShowDealForm(false); setEditDeal(null); load(); }}
        />
      )}
      {showPrep && <PreMeetingPrep account={account} contacts={contacts} deals={deals} notes={notes} onClose={() => setShowPrep(false)} />}
      {showReview && <DealReview deal={showReview} onClose={() => setShowReview(null)} />}
      {showMeddic && (
        <MeddicPanel
          deal={showMeddic}
          onClose={() => setShowMeddic(null)}
          onSaved={(score) => {
            setDeals(prev => prev.map(d => d.id === showMeddic.id ? { ...d, meddic_score: score } : d));
            setShowMeddic(prev => prev ? { ...prev, meddic_score: score } : null);
          }}
        />
      )}
    </div>
  );
}
