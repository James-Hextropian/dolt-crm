import { useState, useEffect } from 'react';
import { useAuth, authFetch } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './components/Dashboard';
import AccountList from './components/AccountList';
import AccountDetail from './components/AccountDetail';
import KanbanBoard from './components/KanbanBoard';
import VersionHistory from './components/VersionHistory';
import ProspectingEngine from './components/ProspectingEngine';
import UserManagement from './components/admin/UserManagement';
import UserMenu from './components/UserMenu';

export default function App() {
  const { user, loading, logout } = useAuth();

  const [view, setView]         = useState('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  const openDetail = (id) => { setSelectedAccountId(id); setView('detail'); };
  const handleBack = () => { setView('accounts'); setSelectedAccountId(null); };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const isAdmin = user.role === 'admin';

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand" onClick={() => setView('dashboard')}>
          <div className="brand-icon">⑂</div>
          <span className="brand-name">DoltHub <span className="brand-sub">CRM</span></span>
        </div>

        <nav className="header-nav">
          <button className={`nav-btn${view === 'dashboard' ? ' active' : ''}`} onClick={() => setView('dashboard')}>
            Dashboard
          </button>
          <button className={`nav-btn${view === 'accounts' || view === 'detail' ? ' active' : ''}`} onClick={() => setView('accounts')}>
            Accounts
          </button>
          <button className={`nav-btn${view === 'pipeline' ? ' active' : ''}`} onClick={() => setView('pipeline')}>
            Pipeline
          </button>
          <button className={`nav-btn${view === 'prospecting' ? ' active' : ''}`} onClick={() => setView('prospecting')}>
            Prospecting
          </button>
          <button className={`nav-btn nav-btn-dolt${view === 'history' ? ' active' : ''}`} onClick={() => setView('history')}>
            ⑂ Version History
          </button>
          {isAdmin && (
            <button className={`nav-btn${view === 'admin' ? ' active' : ''}`} onClick={() => setView('admin')}>
              Admin
            </button>
          )}
        </nav>

        <div className="header-right">
          <UserMenu onLogout={logout} user={user} />
        </div>
      </header>

      <main className="app-main">
        {view === 'dashboard' && <Dashboard onViewAccount={openDetail} />}
        {view === 'accounts'  && <AccountList onViewDetail={openDetail} />}
        {view === 'detail'    && <AccountDetail accountId={selectedAccountId} onBack={handleBack} />}
        {view === 'pipeline'      && <KanbanBoard onViewDetail={openDetail} />}
        {view === 'prospecting'   && <ProspectingEngine onConvertToAccount={openDetail} />}
        {view === 'history'       && <VersionHistory />}
        {view === 'admin' && isAdmin && <UserManagement />}
      </main>
    </div>
  );
}
