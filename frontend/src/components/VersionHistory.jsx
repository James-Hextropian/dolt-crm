import { useState, useEffect } from 'react';
import { authFetch } from '../context/AuthContext';

const TABLES = ['accounts','contacts','deals','notes'];

function relTime(d) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function VersionHistory() {
  const [tab, setTab]         = useState('log');
  const [log, setLog]         = useState([]);
  const [branches, setBranches] = useState([]);
  const [diffTable, setDiffTable] = useState('accounts');
  const [diffRows, setDiffRows]   = useState([]);
  const [diffCols, setDiffCols]   = useState([]);
  const [ttTable, setTtTable]     = useState('accounts');
  const [ttCommit, setTtCommit]   = useState('');
  const [ttRows, setTtRows]       = useState([]);
  const [ttCols, setTtCols]       = useState([]);
  const [ttLoading, setTtLoading] = useState(false);
  const [ttError, setTtError]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [l, b] = await Promise.all([
          authFetch('/api/dolt/log'),
          authFetch('/api/dolt/branches'),
        ]);
        setLog(l);
        setBranches(b);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  const loadDiff = async () => {
    try {
      const rows = await authFetch(`/api/dolt/diff/${diffTable}`);
      setDiffRows(rows);
      if (rows.length > 0) {
        setDiffCols(Object.keys(rows[0]).filter(k => k !== 'diff_type'));
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => { if (tab === 'diff') loadDiff(); }, [tab, diffTable]);

  const runTimeTravel = async () => {
    if (!ttCommit.trim()) return;
    setTtLoading(true);
    setTtError(null);
    try {
      const rows = await authFetch(`/api/dolt/timetravel/${ttTable}?commit=${ttCommit.trim()}`);
      setTtRows(rows);
      if (rows.length > 0) setTtCols(Object.keys(rows[0]));
    } catch (err) { setTtError(err.message); }
    finally { setTtLoading(false); }
  };

  const restoreVersion = async () => {
    if (!confirm(`Are you sure? This will hard-reset the database to commit ${ttCommit}. All changes after this commit will be lost.`)) return;
    setRestoring(true);
    try {
      await authFetch('/api/dolt/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commit: ttCommit.trim() }),
      });
      alert('Database restored to that commit. Reload to see changes.');
    } catch (err) { alert(err.message); }
    finally { setRestoring(false); }
  };

  return (
    <div className="vh-layout">
      <div className="vh-header">
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>⑂ Version History</h2>
        <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>Powered by Dolt — Git for Data</span>
      </div>

      <div className="vh-tabs">
        {[
          { id: 'log',        label: '📋 Commit Log' },
          { id: 'diff',       label: '🔀 Table Diff' },
          { id: 'timetravel', label: '⏮ Time Travel' },
          { id: 'branches',   label: '🌿 Branches' },
        ].map(t => (
          <button key={t.id} className={`vh-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: 'var(--muted)' }}>Loading…</div>}

      {/* Commit Log */}
      {!loading && tab === 'log' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
          <div className="commit-timeline">
            {log.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>No commits yet. Make some CRM changes first.</div>
            ) : log.map((c, i) => (
              <div key={i} className="commit-entry">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, paddingTop: 4 }}>
                  <div className="commit-dot" />
                  {i < log.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border)', minHeight: 20 }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 3 }}>
                    <span className="commit-hash">{(c.commit_hash || c.hash || '').slice(0, 8)}</span>
                    <span className="commit-msg">{c.message}</span>
                  </div>
                  <div className="commit-meta">
                    {c.committer || c.author} · {relTime(c.date)}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <button
                      style={{ fontSize: 11, background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', color: 'var(--muted)', cursor: 'pointer' }}
                      onClick={() => { setTtCommit((c.commit_hash || c.hash || '').slice(0, 8)); setTab('timetravel'); }}>
                      Time travel →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table Diff */}
      {!loading && tab === 'diff' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', alignItems: 'center' }}>
            <label style={{ flexDirection: 'row', gap: 8, alignItems: 'center', textTransform: 'none', letterSpacing: 'normal', fontWeight: 400, color: 'var(--text)' }}>
              Table:
              <select value={diffTable} onChange={e => setDiffTable(e.target.value)}>
                {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Showing diff between HEAD~1 and HEAD</span>
          </div>
          {diffRows.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>No changes between last two commits for <strong>{diffTable}</strong>.</div>
          ) : (
            <div className="table-wrap">
              <table className="diff-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    {diffCols.map(c => <th key={c}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {diffRows.map((row, i) => {
                    const type = row.diff_type || '';
                    const cls = type === 'added' ? 'diff-added' : type === 'removed' ? 'diff-removed' : '';
                    return (
                      <tr key={i} className={cls}>
                        <td className="diff-row-type" style={{ color: type === 'added' ? 'var(--green)' : type === 'removed' ? 'var(--red)' : 'var(--muted)' }}>
                          {type === 'added' ? '+' : type === 'removed' ? '−' : '~'}
                        </td>
                        {diffCols.map(c => <td key={c}>{String(row[c] ?? '')}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Time Travel */}
      {!loading && tab === 'timetravel' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: '1rem' }}>
            Query any table as it existed at a past commit. Paste a commit hash from the log above.
          </p>
          <div className="timetravel-panel">
            <div className="timetravel-input">
              <select value={ttTable} onChange={e => setTtTable(e.target.value)} style={{ width: 130 }}>
                {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                value={ttCommit}
                onChange={e => setTtCommit(e.target.value)}
                placeholder="Commit hash (e.g. a1b2c3d)"
                style={{ flex: 1, fontFamily: 'monospace' }}
              />
              <button className="btn-primary" onClick={runTimeTravel} disabled={ttLoading || !ttCommit.trim()}>
                {ttLoading ? 'Querying…' : 'Query'}
              </button>
            </div>

            {ttError && <div className="error-banner">{ttError}</div>}

            {ttRows.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{ttRows.length} rows at <code style={{ background: 'var(--surface2)', padding: '1px 5px', borderRadius: 3 }}>{ttCommit}</code></span>
                  <button className="btn-danger" onClick={restoreVersion} disabled={restoring}>
                    {restoring ? 'Restoring…' : '⚠ Restore This Version'}
                  </button>
                </div>
                <div className="table-wrap">
                  <table className="diff-table">
                    <thead>
                      <tr>{ttCols.map(c => <th key={c}>{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {ttRows.map((row, i) => (
                        <tr key={i}>
                          {ttCols.map(c => <td key={c}>{String(row[c] ?? '')}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Branches */}
      {!loading && tab === 'branches' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
          <table className="data-table">
            <thead>
              <tr><th>Branch</th><th>Latest Commit</th><th>Last Updated</th></tr>
            </thead>
            <tbody>
              {branches.map((b, i) => (
                <tr key={i}>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--accent)' }}>⑂</span>
                      <strong>{b.name}</strong>
                      {b.name === 'main' && (
                        <span className="badge" style={{ background: 'var(--accent)', fontSize: 10 }}>current</span>
                      )}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)' }}>
                    {(b.hash || '').slice(0, 8)}
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {b.latest_committer_date ? relTime(b.latest_committer_date) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
