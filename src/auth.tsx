import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, HeartPulse, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';

export type Account = { id: string; email: string; name: string; role: 'patient' | 'clinician' };
type AuthState = { user: Account; loading: boolean; signOut: () => Promise<void> };
const AuthContext = createContext<AuthState | null>(null);

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Request failed.');
  return body;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    jsonRequest('/api/auth?action=me')
      .then(data => { if (mounted) setUser(data.authenticated ? data.user : null); })
      .catch(() => { if (mounted) setUser(null); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  async function signOut() {
    try { await jsonRequest('/api/auth?action=logout', { method: 'POST' }); }
    finally { setUser(null); }
  }
  if (loading) return <div className="auth-loading" role="status">Checking your secure session…</div>;
  if (!user) return <LoginScreen onSuccess={setUser} />;
  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>;
}

function LoginScreen({ onSuccess }: { onSuccess: (user: Account) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const data = await jsonRequest('/api/auth?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      onSuccess(data.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed. Please try again.');
    } finally { setBusy(false); }
  }
  return <main className="auth-page">
    <section className="auth-card">
      <a className="brand auth-brand" href="/" aria-label="WellSpring home">
        <span className="brand-mark"><HeartPulse size={22}/></span>
        <span><strong>WellSpring</strong><small>PS13 · connected care</small></span>
      </a>
      <div className="auth-emblem"><LockKeyhole size={25}/></div>
      <div className="eyebrow auth-eyebrow"><span className="dot"/> SECURE CARE WORKSPACE</div>
      <h1>Welcome back.</h1>
      <p className="auth-intro">Sign in to access your WellSpring workspace. Your role determines which care features you can use.</p>
      <form onSubmit={submit} className="auth-form">
        <label htmlFor="login-email">Email address</label>
        <div className="auth-input"><UserRound size={17}/><input id="login-email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required maxLength={254}/></div>
        <label htmlFor="login-password">Password</label>
        <div className="auth-input"><LockKeyhole size={17}/><input id="login-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" required maxLength={1024}/></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="primary-btn auth-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'} <ArrowRight size={17}/></button>
      </form>
      <div className="auth-safety"><ShieldCheck size={17}/><span>Session protected · Role-based workspace · Clinician-led decisions</span></div>
      <p className="auth-footnote">Prototype accounts are provisioned by the project administrator. Do not enter real patient information in this hackathon demo.</p>
    </section>
  </main>;
}

export function AuthHeader() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  return <div className="auth-account">
    <span className="account-avatar">{user.name.slice(0,1).toUpperCase()}</span>
    <span className="account-details"><strong>{user.name}</strong><small>{user.role === 'clinician' ? 'Clinician workspace' : 'Patient workspace'}</small></span>
    <button type="button" onClick={() => void signOut()} className="logout-btn">Sign out</button>
  </div>;
}
