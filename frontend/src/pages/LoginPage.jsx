import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password, remember);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '2.5rem', width: '100%', maxWidth: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 52, height: 52, background: 'var(--accent)',
            borderRadius: 10, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 24, margin: '0 auto 12px',
          }}>⑂</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>DoltHub CRM</div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Sign in to your account</div>
        </div>

        {error && (
          <div className="error-banner">{error}</div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label>
            Email
            <input
              type="email" required autoFocus value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@dolthub.com"
            />
          </label>
          <label>
            Password
            <input
              type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" id="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: 'var(--accent)' }} />
            <label htmlFor="remember" style={{ flexDirection: 'row', textTransform: 'none', letterSpacing: 'normal', color: 'var(--muted)', fontWeight: 400, gap: 0 }}>
              Remember me (30 days)
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '11px 0', fontSize: 14, marginTop: 4 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: 12, color: 'var(--muted)' }}>
          Powered by Dolt — Git for Data ⑂
        </div>
      </div>
    </div>
  );
}
