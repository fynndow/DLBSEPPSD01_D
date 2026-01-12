import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { supabase } from './lib/supabaseClient';
import './App.css';

type Mode = 'login' | 'register';
type View = 'dashboard' | 'profile';

type LinkItem = {
  id: string;
  shortCode: string;
  originalUrl: string;
  expiresLabel: string;
  expiresAt: string | null;
  label: string | null;
  clickCount: number;
};

type ApiLink = {
  id: string;
  short_code: string;
  original_url: string;
  expires_at: string | null;
  click_count: number;
  label?: string | null;
  created_at?: string;
};

const expiryOptions = [
  { value: '1', label: 'Default 1 Tag' },
  { value: '7', label: '7 Tage' },
  { value: '30', label: '30 Tage' },
  { value: 'never', label: 'Kein Ablaufdatum' },
];

const runtimeHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const runtimeProtocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || `${runtimeProtocol}//${runtimeHost}:3000`;
const ITEMS_PER_PAGE = 3;

function formatDate(value: string | null) {
  if (!value) {
    return 'kein Ablaufdatum';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'kein Ablaufdatum';
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function mapApiLink(link: ApiLink): LinkItem {
  return {
    id: link.id,
    shortCode: link.short_code,
    originalUrl: link.original_url,
    expiresLabel: formatDate(link.expires_at),
    expiresAt: link.expires_at,
    label: link.label ?? null,
    clickCount: link.click_count ?? 0,
  };
}

function computeExpiresAt(option: string) {
  if (option === 'never') {
    return null;
  }
  const days = Number(option);
  if (Number.isNaN(days)) {
    return null;
  }
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function isActiveLink(link: LinkItem) {
  if (!link.expiresAt) {
    return true;
  }
  const time = Date.parse(link.expiresAt);
  if (Number.isNaN(time)) {
    return true;
  }
  return time > Date.now();
}

function matchesSearch(link: LinkItem, term: string) {
  const normalized = term.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  const label = link.label?.toLowerCase() ?? '';
  return label.includes(normalized) || link.shortCode.toLowerCase().includes(normalized);
}

function mapAuthErrorMessage(message: string) {
  if (message.includes('Unable to validate email address: invalid format')) {
    return 'Bitte eine gültige E-Mail-Adresse eingeben.';
  }
  return message;
}

function App() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profilePasswordConfirm, setProfilePasswordConfirm] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isAccountDeleteModalOpen, setIsAccountDeleteModalOpen] = useState(false);

  const [targetUrl, setTargetUrl] = useState('');
  const [label, setLabel] = useState('');
  const [expiresIn, setExpiresIn] = useState(expiryOptions[0].value);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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

  useEffect(() => {
    if (session?.user?.email) {
      setProfileEmail(session.user.email);
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (!session?.access_token) {
      setLinks([]);
      setActiveLinkId(null);
      return;
    }

    const fetchLinks = async () => {
      setLinksLoading(true);
      setLinksError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/shortlinks`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || 'Konnte Links nicht laden.');
        }

        const data = (await response.json()) as ApiLink[];
        const mapped = data.map(mapApiLink);
        setLinks(mapped);
        setActiveLinkId((current) =>
          mapped.some((link) => link.id === current) ? current : mapped[0]?.id ?? null
        );
      } catch (fetchError) {
        setLinksError(
          fetchError instanceof Error ? fetchError.message : 'Konnte Links nicht laden.'
        );
      } finally {
        setLinksLoading(false);
      }
    };

    fetchLinks();
  }, [session?.access_token]);

  useEffect(() => {
    if (links.length === 0) {
      if (activeLinkId !== null) {
        setActiveLinkId(null);
      }
      return;
    }

    const active = links.filter(isActiveLink);
    const preferredId = active[0]?.id ?? links[0].id;
    const activeIds = new Set(active.map((link) => link.id));
    if (!activeLinkId || !activeIds.has(activeLinkId)) {
      setActiveLinkId(preferredId);
    }
  }, [links, activeLinkId]);

  const isSignedIn = Boolean(session?.user);
  useEffect(() => {
    if (!isSignedIn) {
      setView('dashboard');
    }
  }, [isSignedIn]);
  const userLabel = useMemo(() => {
    const metadataName = session?.user.user_metadata?.name;
    return metadataName || session?.user.email || 'User';
  }, [session]);

  const resetStatus = () => {
    setError(null);
    setMessage(null);
  };

  const resetProfileStatus = () => {
    setProfileError(null);
    setProfileMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetStatus();
    setLoading(true);

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirm = passwordConfirm.trim();

    if (!trimmedEmail) {
      setError('Bitte eine E-Mail-Adresse eingeben.');
      setLoading(false);
      return;
    }

    if (!trimmedEmail.includes('@')) {
      setError('Bitte eine gültige E-Mail eingeben.');
      setLoading(false);
      return;
    }

    if (!trimmedPassword) {
      setError('Bitte ein Passwort eingeben.');
      setLoading(false);
      return;
    }

    if (mode === 'register') {
      if (!trimmedName) {
        setError('Bitte einen Namen eingeben.');
        setLoading(false);
        return;
      }
      if (!trimmedConfirm) {
        setError('Bitte das Passwort bestätigen.');
        setLoading(false);
        return;
      }
      if (trimmedPassword !== trimmedConfirm) {
        setError('Die Passwörter stimmen nicht überein.');
        setLoading(false);
        return;
      }
    }

    const authPayload = { email, password };
    const result =
      mode === 'register'
        ? await supabase.auth.signUp({
            ...authPayload,
            options: { data: { name: name.trim() || undefined } },
          })
        : await supabase.auth.signInWithPassword(authPayload);

    if (result.error) {
      setError(mapAuthErrorMessage(result.error.message));
    } else if (mode === 'register') {
      setMessage('Registrierung erfolgreich. Bitte prüfe deine E-Mail.');
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

  const handleUpdateEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profileEmail.trim()) {
      setProfileError('Bitte eine gültige E-Mail eingeben.');
      return;
    }
    resetProfileStatus();
    setProfileLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      email: profileEmail.trim(),
    });
    if (updateError) {
      setProfileError(updateError.message);
    } else {
      setProfileMessage('E-Mail-Update angefragt. Bitte bestätigen.');
    }
    setProfileLoading(false);
  };

  const handleUpdatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profilePassword.trim()) {
      setProfileError('Bitte ein neues Passwort eingeben.');
      return;
    }
    if (profilePassword !== profilePasswordConfirm) {
      setProfileError('Passwörter stimmen nicht überein.');
      return;
    }
    resetProfileStatus();
    setProfileLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: profilePassword,
    });
    if (updateError) {
      setProfileError(updateError.message);
    } else {
      setProfileMessage('Passwort aktualisiert.');
      setProfilePassword('');
      setProfilePasswordConfirm('');
    }
    setProfileLoading(false);
  };

  const openAccountDeleteModal = () => {
    setIsAccountDeleteModalOpen(true);
  };

  const closeAccountDeleteModal = () => {
    setIsAccountDeleteModalOpen(false);
  };

  const handleDeleteAccount = async () => {
    if (!session?.access_token) {
      setProfileError('Bitte zuerst einloggen.');
      return;
    }
    resetProfileStatus();
    setProfileLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/account`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Konto konnte nicht gelöscht werden.');
      }
      await supabase.auth.signOut();
      setProfileMessage('Konto gelöscht.');
      closeAccountDeleteModal();
    } catch (accountError) {
      setProfileError(
        accountError instanceof Error
          ? accountError.message
          : 'Konto konnte nicht gelöscht werden.'
      );
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCreateLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLinkMessage(null);
    setLinksError(null);

    const trimmedUrl = targetUrl.trim();
    if (!trimmedUrl) {
      setLinkMessage('Bitte gib eine Ziel-URL ein.');
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      setLinkMessage('Die URL ist ungültig.');
      return;
    }

    if (!session?.access_token) {
      setLinkMessage('Bitte zuerst einloggen.');
      return;
    }

    setLinksLoading(true);
    try {
      const payload = {
        originalUrl: trimmedUrl,
        label: label.trim() || undefined,
        expiresAt: computeExpiresAt(expiresIn),
      };

      const response = await fetch(`${apiBaseUrl}/api/shortlinks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Kurzlink konnte nicht erstellt werden.');
      }

      const data = (await response.json()) as ApiLink;
      const mapped = mapApiLink(data);
      setLinks((prev) => [mapped, ...prev]);
      setActiveLinkId(mapped.id);
      setTargetUrl('');
      setLabel('');
      setExpiresIn(expiryOptions[0].value);
      setLinkMessage('Kurzlink erstellt.');
    } catch (createError) {
      setLinkMessage(
        createError instanceof Error
          ? createError.message
          : 'Kurzlink konnte nicht erstellt werden.'
      );
    } finally {
      setLinksLoading(false);
    }
  };

  const activeLink = links.find((link) => link.id === activeLinkId);
  const shortBaseUrl = import.meta.env.VITE_SHORT_BASE_URL || `${apiBaseUrl}/r`;
  const shortUrl = activeLink ? `${shortBaseUrl}/${activeLink.shortCode}` : '';
  const activeLinks = useMemo(() => links.filter(isActiveLink), [links]);
  const expiredCount = links.length - activeLinks.length;
  const filteredLinks = useMemo(
    () => activeLinks.filter((link) => matchesSearch(link, searchTerm)),
    [activeLinks, searchTerm]
  );
  const totalPages = Math.max(1, Math.ceil(filteredLinks.length / ITEMS_PER_PAGE));
  const pageStart = (page - 1) * ITEMS_PER_PAGE;
  const pageLinks = filteredLinks.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  useEffect(() => {
    if (!shortUrl) {
      setQrDataUrl('');
      return;
    }
    let isCurrent = true;
    QRCode.toDataURL(shortUrl, {
      width: 220,
      margin: 1,
      color: { dark: '#111111', light: '#f5f5f5' },
    })
      .then((dataUrl) => {
        if (isCurrent) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setQrDataUrl('');
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [shortUrl]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (filteredLinks.length === 0) {
      return;
    }
    if (!activeLinkId || !filteredLinks.some((link) => link.id === activeLinkId)) {
      setActiveLinkId(filteredLinks[0].id);
    }
  }, [filteredLinks, activeLinkId]);

  const handleShare = async () => {
    if (!qrDataUrl) {
      setShareError('Kein QR-Code vorhanden.');
      setShareMessage(null);
      return;
    }

    setShareError(null);
    setShareMessage(null);

    try {
      const response = await fetch(qrDataUrl);
      const blob = await response.blob();
      const fileName = activeLink ? `qr-${activeLink.shortCode}.png` : 'qr-code.png';
      const file = new File([blob], fileName, { type: blob.type || 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'QR-Code' });
        setShareMessage('QR-Code geteilt.');
        return;
      }

      if (navigator.clipboard && 'write' in navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ [file.type]: blob })]);
        setShareMessage('QR-Code kopiert.');
        return;
      }

      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = fileName;
      downloadLink.click();
      URL.revokeObjectURL(downloadLink.href);
      setShareMessage('QR-Code gespeichert.');
    } catch {
      setShareError('Konnte den QR-Code nicht teilen.');
    }
  };

  const handleCopyLink = async (linkShortCode: string) => {
    const linkUrl = `${shortBaseUrl}/${linkShortCode}`;
    setCopyError(null);
    setCopyMessage(null);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(linkUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = linkUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!ok) {
          throw new Error('copy failed');
        }
      }
      setCopyMessage('Link kopiert.');
      window.setTimeout(() => {
        setCopyMessage(null);
      }, 2000);
    } catch {
      setCopyError('Konnte den Link nicht kopieren.');
      window.setTimeout(() => {
        setCopyError(null);
      }, 2000);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!session?.access_token) {
      setDeleteError('Bitte zuerst einloggen.');
      return false;
    }

    setDeleteError(null);
    setDeleteMessage(null);
    setLinksLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/shortlinks/${linkId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Löschen fehlgeschlagen.');
      }

      setLinks((prev) => prev.filter((link) => link.id !== linkId));
      setDeleteMessage('Link gelöscht.');
      return true;
    } catch (deleteErr) {
      setDeleteError(
        deleteErr instanceof Error ? deleteErr.message : 'Löschen fehlgeschlagen.'
      );
      return false;
    } finally {
      setLinksLoading(false);
    }
  };

  const openDeleteModal = (linkId: string) => {
    setPendingDeleteId(linkId);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setPendingDeleteId(null);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) {
      return;
    }
    const success = await handleDeleteLink(pendingDeleteId);
    if (success) {
      closeDeleteModal();
    }
  };

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
                  setPasswordConfirm('');
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
                  setPasswordConfirm('');
                }}
              >
                Registrieren
              </button>
            </div>

            <div className="auth-copy">
              <h1>{mode === 'login' ? 'Logge dich ein' : 'Registriere dich'}</h1>
              <p>
                {mode === 'login'
                  ? 'Logge dich ein um deine Links zu kürzen!'
                  : 'Registriere dich um deine Links zu kürzen!'}
              </p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
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
              {mode === 'register' && (
                <label>
                  <span>Passwort bestätigen</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={passwordConfirm}
                    onChange={(event) => setPasswordConfirm(event.target.value)}
                    placeholder="Passwort wiederholen"
                    required
                  />
                </label>
              )}
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
            <div className="topbar-left">
              <button
                className={view === 'dashboard' ? 'chip active' : 'chip'}
                type="button"
                onClick={() => setView('dashboard')}
              >
                Dashboard
              </button>
              <button
                className={view === 'profile' ? 'chip active' : 'chip'}
                type="button"
                onClick={() => setView('profile')}
              >
                Profil
              </button>
            </div>
            <div className="greeting">Hallo {userLabel}!</div>
            <div className="topbar-right">
              <button className="chip" type="button" onClick={handleSignOut}>
                Abmelden
              </button>
            </div>
          </header>

          {view === 'dashboard' ? (
            <section className="dashboard-grid">
            <article className="card">
              <h2>Verkürzen Sie hier Ihren Link</h2>
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
                  <span>Eigener Kurzname (nur für dich)</span>
                  <input
                    type="text"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
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
              <div className="link-summary">
                <div className="summary-header">Aktiver Link</div>
                {activeLink ? (
                  <>
                    <p className="summary-url">{shortUrl}</p>
                    <p className="summary-meta">
                      {activeLink.label ? `${activeLink.label} - ` : ''}
                      Ablaufdatum: {activeLink.expiresLabel} - Aufrufe: {activeLink.clickCount}
                    </p>
                  </>
                ) : (
                  <p className="status info">Noch kein Link ausgewählt.</p>
                )}
                <div className="summary-stats">
                  <div>
                    <span>Gesamt</span>
                    <strong>{links.length}</strong>
                  </div>
                  <div>
                    <span>Aktiv</span>
                    <strong>{activeLinks.length}</strong>
                  </div>
                  <div>
                    <span>Abgelaufen</span>
                    <strong>{expiredCount}</strong>
                  </div>
                </div>
              </div>
            </article>

            <article className="card">
              <h2>Letzte aktive Links</h2>
              {linksLoading && <p className="status info">Links werden geladen...</p>}
              {linksError && (
                <p className="status error" role="alert">
                  {linksError}
                </p>
              )}
              <div className="search-bar">
                <label>
                  <span>Suche nach Kurzname</span>
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="z.B. kampagne-jan"
                  />
                </label>
              </div>
              <div className="links-list">
                {filteredLinks.length === 0 && !linksLoading ? (
                  <p className="status info">Keine aktiven Links vorhanden.</p>
                ) : (
                  pageLinks.map((link) => (
                    <div
                      key={link.id}
                      className={link.id === activeLinkId ? 'link-row active' : 'link-row'}
                      onClick={() => setActiveLinkId(link.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setActiveLinkId(link.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="link-header">
                        <div className="link-text">
                          {shortBaseUrl}/{link.shortCode}
                        </div>
                        <div className="link-actions">
                          <button
                            type="button"
                            className="copy-inline"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCopyLink(link.shortCode);
                            }}
                          >
                            Kopieren
                          </button>
                          <button
                            type="button"
                            className="delete-inline"
                            onClick={(event) => {
                              event.stopPropagation();
                              openDeleteModal(link.id);
                            }}
                          >
                          Löschen
                          </button>
                        </div>
                      </div>
                      <div className="link-meta">
                        {link.label ? `${link.label} - ` : ''}
                        Ablaufdatum: {link.expiresLabel} - Aufrufe: {link.clickCount}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {copyMessage && <p className="status success">{copyMessage}</p>}
              {copyError && (
                <p className="status error" role="alert">
                  {copyError}
                </p>
              )}
              {deleteMessage && <p className="status success">{deleteMessage}</p>}
              {deleteError && (
                <p className="status error" role="alert">
                  {deleteError}
                </p>
              )}
              {filteredLinks.length > ITEMS_PER_PAGE ? (
                <div className="pagination">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                  >
                    Zurück
                  </button>
                  <span>
                    Seite {page} von {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page === totalPages}
                  >
                    Weiter
                  </button>
                </div>
              ) : null}
              {expiredCount > 0 && !linksLoading ? (
                <p className="status info">
                  {expiredCount} Link(s) sind abgelaufen und werden ausgeblendet.
                </p>
              ) : null}
              {activeLink ? (
                <>
                  <div className="qr-box">
                    <p>QR-Code des ausgewählten links</p>
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="QR Code" />
                    ) : (
                      <span>{activeLink.shortCode}</span>
                    )}
                  </div>
                  <div className="share-actions">
                    <button
                      className="share-button"
                      type="button"
                      onClick={handleShare}
                      disabled={!qrDataUrl}
                    >
                      QR-Code teilen
                    </button>
                    {shareMessage && <p className="status success">{shareMessage}</p>}
                    {shareError && (
                      <p className="status error" role="alert">
                        {shareError}
                      </p>
                    )}
                  </div>
                </>
              ) : null}
            </article>
          </section>
          ) : (
            <section className="profile-grid">
              <article className="card">
                <h2>Profil-Einstellungen</h2>
                <p className="profile-note">
                  Verwalte deine Login-Daten und dein Konto.
                </p>
                <div className="profile-section">
                  <h3>E-Mail ändern</h3>
                  <form className="profile-form" onSubmit={handleUpdateEmail}>
                    <label>
                      <span>Neue E-Mail</span>
                      <input
                        type="email"
                        autoComplete="email"
                        value={profileEmail}
                        onChange={(event) => setProfileEmail(event.target.value)}
                        placeholder="name@mail.com"
                        required
                      />
                    </label>
                    <button className="profile-button" type="submit" disabled={profileLoading}>
                      E-Mail speichern
                    </button>
                  </form>
                </div>

                <div className="profile-section">
                  <h3>Passwort ändern</h3>
                  <form className="profile-form" onSubmit={handleUpdatePassword}>
                    <label>
                      <span>Neues Passwort</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={profilePassword}
                        onChange={(event) => setProfilePassword(event.target.value)}
                        placeholder="mind. 8 Zeichen"
                        required
                      />
                    </label>
                    <label>
                      <span>Passwort bestätigen</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={profilePasswordConfirm}
                        onChange={(event) => setProfilePasswordConfirm(event.target.value)}
                        placeholder="Passwort wiederholen"
                        required
                      />
                    </label>
                    <button className="profile-button" type="submit" disabled={profileLoading}>
                      Passwort speichern
                    </button>
                  </form>
                </div>

                <div className="profile-section danger-zone">
                  <h3>Konto löschen</h3>
                  <p>
                    Dein Konto und alle Links werden dauerhaft entfernt.
                  </p>
                  <button
                    className="profile-button danger"
                    type="button"
                    onClick={openAccountDeleteModal}
                    disabled={profileLoading}
                  >
                    Konto löschen
                  </button>
                </div>

                {profileMessage && <p className="status success">{profileMessage}</p>}
                {profileError && (
                  <p className="status error" role="alert">
                    {profileError}
                  </p>
                )}
              </article>
            </section>
          )}
        </main>
      )}
      {isDeleteModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={closeDeleteModal}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-modal-title">Link wirklich löschen?</h3>
            <p>Dieser Schritt kann nicht rückgängig gemacht werden.</p>
            <p className="modal-link">
              {pendingDeleteId
                ? `${shortBaseUrl}/${
                    links.find((link) => link.id === pendingDeleteId)?.shortCode ?? ''
                  }`
                : ''}
            </p>
            <div className="modal-actions">
              <button type="button" className="modal-button ghost" onClick={closeDeleteModal}>
                Abbrechen
              </button>
              <button type="button" className="modal-button danger" onClick={confirmDelete}>
                Löschen
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isAccountDeleteModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={closeAccountDeleteModal}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="account-delete-title">Konto wirklich löschen?</h3>
            <p>Alle deine Links werden entfernt. Dieser Schritt ist endgültig.</p>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-button ghost"
                onClick={closeAccountDeleteModal}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="modal-button danger"
                onClick={handleDeleteAccount}
              >
                Konto löschen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
