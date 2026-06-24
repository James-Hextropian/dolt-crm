import { useState, useRef, useEffect } from 'react';

export default function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = (user?.name || 'U').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="user-menu-wrap" ref={ref}>
      <button className="user-btn" onClick={() => setOpen(v => !v)}>
        <div className="user-avatar">{initials}</div>
        <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.name}
        </span>
        <span style={{ color: 'var(--muted)', fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div className="user-dropdown">
          <div style={{ padding: '8px 12px 4px', fontSize: 12, color: 'var(--muted)' }}>
            {user?.email}
          </div>
          <div style={{ padding: '2px 12px 8px', fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>
            {user?.role?.replace('_', ' ')}
          </div>
          <div className="user-dropdown-sep" />
          <button className="user-dropdown-item danger" onClick={() => { setOpen(false); onLogout(); }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
