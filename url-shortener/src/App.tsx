import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabaseClient';
import './App.css';

type Mode = 'login' | 'register';

type LinkItem = {
  id: string;
  shortCode: string;
  originalUrl: string;
  expiresLabel: string;
  clickCount: number;
};

const seedLinks: LinkItem[] = [
  {
    id: 'seed-1',
    shortCode: 'demo123',
    originalUrl: 'https://example.com',
    expiresLabel: '01.01.1970',
    clickCount: 12,
  },
  {
    id: 'seed-2',
    shortCode: 'hello77',
    originalUrl: 'https://vite.dev',
    expiresLabel: '31.12.2099',
    clickCount: 3,
  },
];

const expiryOptions = [
  { value: '1', label: 'Default 1 Tag' },
  { value: '7', label: '7 Tage' },
  { value: '30', label: '30 Tage' },
  { value: 'never', label: 'Kein Ablaufdatum' },
];

function generateLocalCode(length = 7) {
  return Math.random().toString(36).slice(2, 2 + length);
}

function App() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [targetUrl, setTargetUrl] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [expiresIn, setExpiresIn] = useState(expiryOptions[0].value);
  const [links, setLinks] = useState<LinkItem[]>(seedLinks);
  const [activeLinkId, setActiveLinkId] = useState<string | null>(
    seedLinks[0]?.id ?? null
  );
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

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
  const userLabel = useMemo(() => {
    const metadataName = session?.user.user_metadata?.name;
    return metadataName || session?.user.email || 'User';
  }, [session]);

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
      mode === 'register'
        ? await supabase.auth.signUp({
            ...authPayload,
            options: { data: { name: name.trim() || undefined } },
          })
        : await supabase.auth.signInWithPassword(authPayload);

    if (result.error) {
      setError(result.error.message);
    } else if (mode === 'register') {
      setMessage('Registrierung erfolgreich. Bitte pruefe deine E-Mail.');
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

  const handleCreateLink = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLinkMessage(null);

    const trimmedUrl = targetUrl.trim();
    if (!trimmedUrl) {
      setLinkMessage('Bitte gib eine Ziel-URL ein.');
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      setLinkMessage('Die URL ist ungueltig.');
      return;
    }

    const newCode = shortCode.trim() || generateLocalCode();
    const expiresLabel =
      expiryOptions.find((option) => option.value === expiresIn)?.label ?? 'Default 1 Tag';

    const newLink: LinkItem = {
      id: `local-${Date.now()}`,
      shortCode: newCode,
      originalUrl: trimmedUrl,
      expiresLabel: expiresLabel.replace('Default ', ''),
      clickCount: 0,
    };

    setLinks((prev) => [newLink, ...prev]);
    setActiveLinkId(newLink.id);
    setTargetUrl('');
    setShortCode('');
    setExpiresIn(expiryOptions[0].value);
    setLinkMessage('Kurzlink erstellt (lokal).');
  };

  const activeLink = links.find((link) => link.id === activeLinkId);

  return (
    <div className="app">
      {!isSignedIn ? (
        <main className="auth-layout">
          <section className="auth-card">
            <div className="auth-toggle">
              <button
                type="button"
                className={mode === 'login' ? 'tab active' : 'tab'}
                onClick={() => {
                  resetStatus();
                  setMode('login');
                }}
              >
                Login
              </button>
              <button
                type="button"
                className={mode === 'register' ? 'tab active' : 'tab'}
                onClick={() => {
                  resetStatus();
                  setMode('register');
                }}
              >
                Registrieren
              </button>
            </div>

            <div className="auth-copy">
              <h1>{mode === 'login' ? 'Logge dich ein' : 'Registriere dich'}</h1>
              <p>
                {mode === 'login'
                  ? 'Logge dich ein um deine Links zu kuerzen!'
                  : 'Registriere dich um deine Links zu kuerzen!'}
              </p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {mode === 'register' && (
                <label>
                  <span>Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Dein Name"
                    required
                  />
                </label>
              )}
              <label>
                <span>E-Mail</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="beispiel@mail.com"
                  required
                />
              </label>
              <label>
                <span>Passwort</span>
                <input
                  type="password"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="mind. 8 Zeichen"
                  required
                />
              </label>
              <button className="cta" type="submit" disabled={loading}>
                {loading ? 'Bitte warten...' : mode === 'login' ? 'Anmelden' : 'Registrieren'}
              </button>
            </form>

            {error && (
              <p className="status error" role="alert">
                {error}
              </p>
            )}
            {message && <p className="status success">{message}</p>}
          </section>
        </main>
      ) : (
        <main className="dashboard">
          <header className="topbar">
            <button className="chip" type="button">
              Dashboard
            </button>
            <div className="greeting">Hallo {userLabel}!</div>
            <button className="chip" type="button" onClick={handleSignOut}>
              Abmelden
            </button>
          </header>

          <section className="dashboard-grid">
            <article className="card">
              <h2>Verkuerzen Sie hier Ihren Link</h2>
              <form className="link-form" onSubmit={handleCreateLink}>
                <label>
                  <span>Ziel-URL</span>
                  <input
                    type="url"
                    value={targetUrl}
                    onChange={(event) => setTargetUrl(event.target.value)}
                    placeholder="https://example.com"
                    required
                  />
                </label>
                <label>
                  <span>Eigener Kurzname (optional)</span>
                  <input
                    type="text"
                    value={shortCode}
                    onChange={(event) => setShortCode(event.target.value)}
                    placeholder="Beispiel"
                  />
                </label>
                <label>
                  <span>Ablaufzeit</span>
                  <select
                    value={expiresIn}
                    onChange={(event) => setExpiresIn(event.target.value)}
                  >
                    {expiryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="cta" type="submit">
                  Kurzlink erstellen
                </button>
              </form>
              {linkMessage && <p className="status info">{linkMessage}</p>}
            </article>

            <article className="card">
              <h2>Meine Links</h2>
              <div className="links-list">
                {links.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    className={link.id === activeLinkId ? 'link-row active' : 'link-row'}
                    onClick={() => setActiveLinkId(link.id)}
                  >
                    <div className="link-text">{link.originalUrl}</div>
                    <div className="link-meta">
                      {link.shortCode} - Ablaufdatum: {link.expiresLabel} - counter:{' '}
                      {link.clickCount}
                    </div>
                  </button>
                ))}
              </div>
              <div className="qr-box">
                <p>QR-Code des ausgewaehlten links</p>
                <span>{activeLink?.shortCode ?? '--'}</span>
              </div>
            </article>
          </section>
        </main>
      )}
    </div>
  );
}

export default App;
