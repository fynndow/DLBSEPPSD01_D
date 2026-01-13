import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import AppUI from './AppUI';
import { supabase } from './lib/supabaseClient';
import './App.css';

export type Mode = 'login' | 'register';
export type View = 'dashboard' | 'profile';

export type LinkItem = {
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

// Use runtime host/protocol so LAN IPs work without hardcoding .env values.
const runtimeHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const runtimeProtocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || `${runtimeProtocol}//${runtimeHost}:3000`;
const ITEMS_PER_PAGE = 3;
export type LinkFilter = 'active' | 'expired';

// --- Helper utilities ---
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
  // --- Auth form + session state ---
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // --- UI view + profile settings state ---
  const [view, setView] = useState<View>('dashboard');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profilePasswordConfirm, setProfilePasswordConfirm] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isAccountDeleteModalOpen, setIsAccountDeleteModalOpen] = useState(false);

  // --- Link creation, list, and QR state ---
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
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('active');

  // --- Session bootstrap + auth listener ---
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

  // --- Profile defaults from session ---
  useEffect(() => {
    if (session?.user?.email) {
      setProfileEmail(session.user.email);
    }
  }, [session?.user?.email]);

  // --- Fetch links for the signed-in user ---
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

  // --- Link selection sync for the active/expired toggle ---
  useEffect(() => {
    if (linkFilter === 'expired') {
      if (activeLinkId !== null) {
        setActiveLinkId(null);
      }
      return;
    }

    if (links.length === 0) {
      if (activeLinkId !== null) {
        setActiveLinkId(null);
      }
      return;
    }

    const active = links.filter(isActiveLink);
    const preferredId = active[0]?.id ?? links[0]?.id ?? null;
    const activeIds = new Set(active.map((link) => link.id));
    if (!activeLinkId || !activeIds.has(activeLinkId)) {
      setActiveLinkId(preferredId);
    }
  }, [links, activeLinkId, linkFilter]);

  // --- UI helpers ---
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

  // --- UI state handlers ---
  const handleModeChange = (nextMode: Mode) => {
    resetStatus();
    setMode(nextMode);
    setPasswordConfirm('');
  };

  const handleViewChange = (nextView: View) => {
    setView(nextView);
  };

  const handleNameChange = (value: string) => {
    setName(value);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
  };

  const handlePasswordConfirmChange = (value: string) => {
    setPasswordConfirm(value);
  };

  const handleTargetUrlChange = (value: string) => {
    setTargetUrl(value);
  };

  const handleLabelChange = (value: string) => {
    setLabel(value);
  };

  const handleExpiresInChange = (value: string) => {
    setExpiresIn(value);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleSelectLink = (linkId: string) => {
    setActiveLinkId(linkId);
  };

  const handleLinkFilterChange = (filter: LinkFilter) => {
    setLinkFilter(filter);
  };

  const handleProfileEmailChange = (value: string) => {
    setProfileEmail(value);
  };

  const handleProfilePasswordChange = (value: string) => {
    setProfilePassword(value);
  };

  const handleProfilePasswordConfirmChange = (value: string) => {
    setProfilePasswordConfirm(value);
  };

  // --- Auth actions ---
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

  // --- Profile actions ---
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

  // --- Link creation ---
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

  // --- Derived link data + filtering ---
  const activeLink = links.find((link) => link.id === activeLinkId);
  const shortBaseUrl = import.meta.env.VITE_SHORT_BASE_URL || `${apiBaseUrl}/r`;
  const shortUrl = activeLink ? `${shortBaseUrl}/${activeLink.shortCode}` : '';
  const activeLinks = useMemo(() => links.filter(isActiveLink), [links]);
  const expiredLinks = useMemo(() => links.filter((link) => !isActiveLink(link)), [links]);
  const expiredCount = links.length - activeLinks.length;
  const filteredLinks = useMemo(() => {
    const source = linkFilter === 'expired' ? expiredLinks : activeLinks;
    return source.filter((link) => matchesSearch(link, searchTerm));
  }, [activeLinks, expiredLinks, linkFilter, searchTerm]);
  const totalPages = Math.max(1, Math.ceil(filteredLinks.length / ITEMS_PER_PAGE));
  const pageStart = (page - 1) * ITEMS_PER_PAGE;
  const pageLinks = filteredLinks.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const showQr = linkFilter === 'active' && Boolean(activeLink) && isActiveLink(activeLink!);

  // --- QR generation ---
  useEffect(() => {
    if (!shortUrl || !showQr) {
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
  }, [shortUrl, showQr]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, linkFilter]);

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

  // --- Share/copy actions ---
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

  // --- Link deletion ---
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

  const handlePrevPage = () => {
    setPage((current) => Math.max(1, current - 1));
  };

  const handleNextPage = () => {
    setPage((current) => Math.min(totalPages, current + 1));
  };

  const pendingDeleteUrl = pendingDeleteId
    ? `${shortBaseUrl}/${links.find((link) => link.id === pendingDeleteId)?.shortCode ?? ''}`
    : '';

  return (
    <AppUI
      isSignedIn={isSignedIn}
      mode={mode}
      view={view}
      userLabel={userLabel}
      loading={loading}
      error={error}
      message={message}
      name={name}
      email={email}
      password={password}
      passwordConfirm={passwordConfirm}
      onModeChange={handleModeChange}
      onNameChange={handleNameChange}
      onEmailChange={handleEmailChange}
      onPasswordChange={handlePasswordChange}
      onPasswordConfirmChange={handlePasswordConfirmChange}
      onSubmitAuth={handleSubmit}
      onViewChange={handleViewChange}
      onSignOut={handleSignOut}
      targetUrl={targetUrl}
      label={label}
      expiresIn={expiresIn}
      expiryOptions={expiryOptions}
      onTargetUrlChange={handleTargetUrlChange}
      onLabelChange={handleLabelChange}
      onExpiresInChange={handleExpiresInChange}
      onCreateLink={handleCreateLink}
      linkMessage={linkMessage}
      activeLinksCount={activeLinks.length}
      expiredCount={expiredCount}
      totalLinksCount={links.length}
      linkFilter={linkFilter}
      onLinkFilterChange={handleLinkFilterChange}
      linksLoading={linksLoading}
      linksError={linksError}
      searchTerm={searchTerm}
      onSearchChange={handleSearchChange}
      filteredLinksCount={filteredLinks.length}
      pageLinks={pageLinks}
      activeLinkId={activeLinkId}
      onSelectLink={handleSelectLink}
      shortBaseUrl={shortBaseUrl}
      onCopyLink={handleCopyLink}
      copyMessage={copyMessage}
      copyError={copyError}
      deleteMessage={deleteMessage}
      deleteError={deleteError}
      page={page}
      totalPages={totalPages}
      itemsPerPage={ITEMS_PER_PAGE}
      onPrevPage={handlePrevPage}
      onNextPage={handleNextPage}
      showQr={showQr}
      qrDataUrl={qrDataUrl}
      activeLinkShortCode={activeLink?.shortCode ?? null}
      onShareQr={handleShare}
      shareMessage={shareMessage}
      shareError={shareError}
      isDeleteModalOpen={isDeleteModalOpen}
      pendingDeleteUrl={pendingDeleteUrl}
      onOpenDeleteModal={openDeleteModal}
      onCloseDeleteModal={closeDeleteModal}
      onConfirmDelete={confirmDelete}
      profileEmail={profileEmail}
      profilePassword={profilePassword}
      profilePasswordConfirm={profilePasswordConfirm}
      profileLoading={profileLoading}
      profileMessage={profileMessage}
      profileError={profileError}
      onProfileEmailChange={handleProfileEmailChange}
      onProfilePasswordChange={handleProfilePasswordChange}
      onProfilePasswordConfirmChange={handleProfilePasswordConfirmChange}
      onUpdateEmail={handleUpdateEmail}
      onUpdatePassword={handleUpdatePassword}
      isAccountDeleteModalOpen={isAccountDeleteModalOpen}
      onOpenAccountDeleteModal={openAccountDeleteModal}
      onCloseAccountDeleteModal={closeAccountDeleteModal}
      onDeleteAccount={handleDeleteAccount}
    />
  );
}

export default App;
