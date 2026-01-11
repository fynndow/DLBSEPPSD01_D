import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabaseClient';
import './App.css';

type Mode = 'signin' | 'signup';

function App() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session ?? null);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const isSignedIn = Boolean(session?.user);
  const actionLabel = mode === 'signup' ? 'Create account' : 'Sign in';

  const helperText = useMemo(() => {
    if (mode === 'signup') {
      return 'Create your workspace to start shortening links.';
    }
    return 'Welcome back. Sign in to manage your short links.';
  }, [mode]);

  const resetStatus = () => {
    setError(null);
    setMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetStatus();
    setLoading(true);

    const authPayload = { email, password };
    const result =
      mode === 'signup'
        ? await supabase.auth.signUp(authPayload)
        : await supabase.auth.signInWithPassword(authPayload);

    if (result.error) {
      setError(result.error.message);
    } else if (mode === 'signup') {
      setMessage('Account created. Check your inbox if email confirmation is enabled.');
    }

    setLoading(false);
  };

  const handleSignOut = async () => {
    resetStatus();
    setLoading(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
    }
    setLoading(false);
  };

  const handleCopyToken = async () => {
    if (!session?.access_token) {
      return;
    }
    try {
      await navigator.clipboard.writeText(session.access_token);
      setMessage('Access token copied to clipboard.');
    } catch {
      setError('Could not copy token. Copy it manually.');
    }
  };

  return (
    <div className="page">
      <section className="hero">
        <span className="badge">URL Shortener</span>
        <h1>Make links feel premium.</h1>
        <p className="lead">
          Trim long URLs, track clicks, and keep your links tidy. Built for quick
          campaigns and consistent dashboards.
        </p>
        <div className="stat-grid">
          <div>
            <p className="stat-label">Custom codes</p>
            <p className="stat-value">7-10 chars</p>
          </div>
          <div>
            <p className="stat-label">Analytics</p>
            <p className="stat-value">Per click</p>
          </div>
          <div>
            <p className="stat-label">Expiry</p>
            <p className="stat-value">Optional</p>
          </div>
        </div>
      </section>

      <section className="panel">
        {!isSignedIn ? (
          <>
            <header className="panel-header">
              <h2>{mode === 'signup' ? 'Create account' : 'Sign in'}</h2>
              <p>{helperText}</p>
            </header>
            <form className="auth-form" onSubmit={handleSubmit}>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@studio.io"
                  required
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                />
              </label>
              <button className="primary" type="submit" disabled={loading}>
                {loading ? 'Please wait...' : actionLabel}
              </button>
              {error && (
                <p className="status error" role="alert">
                  {error}
                </p>
              )}
              {message && <p className="status success">{message}</p>}
            </form>
            <div className="switch">
              <span>
                {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
              </span>
              <button
                className="link-button"
                type="button"
                onClick={() => {
                  resetStatus();
                  setMode(mode === 'signup' ? 'signin' : 'signup');
                }}
              >
                {mode === 'signup' ? 'Sign in' : 'Create one'}
              </button>
            </div>
          </>
        ) : (
          <>
            <header className="panel-header">
              <h2>Signed in</h2>
              <p>Keep this token for backend testing or continue to the dashboard.</p>
            </header>
            <div className="session-card">
              <div>
                <p className="stat-label">Account</p>
                <p className="session-value">{session?.user.email}</p>
              </div>
              <div>
                <p className="stat-label">Access token</p>
                <p className="session-value token">{session?.access_token}</p>
              </div>
              <div className="session-actions">
                <button className="ghost" type="button" onClick={handleCopyToken}>
                  Copy token
                </button>
                <button className="primary" type="button" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
              {error && (
                <p className="status error" role="alert">
                  {error}
                </p>
              )}
              {message && <p className="status success">{message}</p>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default App;
