import { useState, useEffect } from 'react';
import { authFetch } from '../context/AuthContext';

function fileIcon(mime) {
  if (!mime) return '📄';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('image')) return '🖼';
  if (mime.includes('word')) return '📝';
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return '📊';
  return '📄';
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes > 1024)        return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default function DocumentManager({ accountId }) {
  const [docs, setDocs]       = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError]     = useState(null);

  const load = async () => {
    try {
      const data = await authFetch(`/api/accounts/${accountId}/documents`);
      setDocs(data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { load(); }, [accountId]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/accounts/${accountId}/documents`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(JSON.parse(text).error || text);
      }
      await load();
    } catch (err) { setError(err.message); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await authFetch(`/api/accounts/${accountId}/documents/${id}`, { method: 'DELETE' });
      setDocs(d => d.filter(x => x.id !== id));
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="doc-manager">
      {error && <div className="error-banner">{error}</div>}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ flexDirection: 'row', gap: 0, textTransform: 'none', letterSpacing: 'normal', fontWeight: 400, color: 'var(--text)' }}>
          <input type="file" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
          <span className="btn-secondary" style={{ cursor: 'pointer' }}>
            {uploading ? 'Uploading…' : '+ Upload Document'}
          </span>
        </label>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>PDF, Word, Excel, images · max 50 MB</span>
      </div>
      <div className="doc-list">
        {docs.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>No documents uploaded yet.</div>
        ) : docs.map(d => (
          <div key={d.id} className="doc-card">
            <span className="doc-icon">{fileIcon(d.mime_type)}</span>
            <div className="doc-info">
              <div className="doc-name">{d.file_name}</div>
              <div className="doc-meta">
                {fmtSize(d.file_size)}
                {d.uploader_name ? ` · ${d.uploader_name}` : ''}
                {` · ${new Date(d.created_at).toLocaleDateString()}`}
              </div>
            </div>
            <div className="doc-actions">
              <a className="btn-icon" href={`/api/accounts/${accountId}/documents/${d.id}/download`} download title="Download">⬇</a>
              <button className="btn-icon" style={{ color: 'var(--red)' }} onClick={() => handleDelete(d.id, d.file_name)} title="Delete">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
