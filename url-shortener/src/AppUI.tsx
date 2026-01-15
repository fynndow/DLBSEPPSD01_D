import type { FormEvent } from 'react';
import type { LinkFilter, LinkItem, Mode, View } from './App';

type ExpiryOption = {
  value: string;
  label: string;
};

type AppUIProps = {
  isSignedIn: boolean;
  mode: Mode;
  view: View;
  userLabel: string;
  loading: boolean;
  error: string | null;
  message: string | null;
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
  onModeChange: (mode: Mode) => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmChange: (value: string) => void;
  onSubmitAuth: (event: FormEvent<HTMLFormElement>) => void;
  onViewChange: (view: View) => void;
  onSignOut: () => void;
  targetUrl: string;
  label: string;
  expiresIn: string;
  expiryOptions: ExpiryOption[];
  onTargetUrlChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  onExpiresInChange: (value: string) => void;
  onCreateLink: (event: FormEvent<HTMLFormElement>) => void;
  linkMessage: string | null;
  activeLinksCount: number;
  expiredCount: number;
  totalLinksCount: number;
  linkFilter: LinkFilter;
  onLinkFilterChange: (filter: LinkFilter) => void;
  linksLoading: boolean;
  linksError: string | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filteredLinksCount: number;
  pageLinks: LinkItem[];
  activeLinkId: string | null;
  onSelectLink: (linkId: string) => void;
  shortBaseUrl: string;
  onCopyLink: (shortCode: string) => void;
  copyMessage: string | null;
  copyError: string | null;
  deleteMessage: string | null;
  deleteError: string | null;
  page: number;
  totalPages: number;
  itemsPerPage: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  showQr: boolean;
  qrDataUrl: string;
  activeLinkShortCode: string | null;
  onShareQr: () => void;
  shareMessage: string | null;
  shareError: string | null;
  isDeleteModalOpen: boolean;
  pendingDeleteUrl: string;
  onOpenDeleteModal: (linkId: string) => void;
  onCloseDeleteModal: () => void;
  onConfirmDelete: () => void;
  profileEmail: string;
  profilePassword: string;
  profilePasswordConfirm: string;
  profileLoading: boolean;
  profileMessage: string | null;
  profileError: string | null;
  onProfileEmailChange: (value: string) => void;
  onProfilePasswordChange: (value: string) => void;
  onProfilePasswordConfirmChange: (value: string) => void;
  onUpdateEmail: (event: FormEvent<HTMLFormElement>) => void;
  onUpdatePassword: (event: FormEvent<HTMLFormElement>) => void;
  isAccountDeleteModalOpen: boolean;
  onOpenAccountDeleteModal: () => void;
  onCloseAccountDeleteModal: () => void;
  onDeleteAccount: () => void;
};

function AppUI({
  isSignedIn,
  mode,
  view,
  userLabel,
  loading,
  error,
  message,
  name,
  email,
  password,
  passwordConfirm,
  onModeChange,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onPasswordConfirmChange,
  onSubmitAuth,
  onViewChange,
  onSignOut,
  targetUrl,
  label,
  expiresIn,
  expiryOptions,
  onTargetUrlChange,
  onLabelChange,
  onExpiresInChange,
  onCreateLink,
  linkMessage,
  activeLinksCount,
  expiredCount,
  totalLinksCount,
  linkFilter,
  onLinkFilterChange,
  linksLoading,
  linksError,
  searchTerm,
  onSearchChange,
  filteredLinksCount,
  pageLinks,
  activeLinkId,
  onSelectLink,
  shortBaseUrl,
  onCopyLink,
  copyMessage,
  copyError,
  deleteMessage,
  deleteError,
  page,
  totalPages,
  itemsPerPage,
  onPrevPage,
  onNextPage,
  showQr,
  qrDataUrl,
  activeLinkShortCode,
  onShareQr,
  shareMessage,
  shareError,
  isDeleteModalOpen,
  pendingDeleteUrl,
  onOpenDeleteModal,
  onCloseDeleteModal,
  onConfirmDelete,
  profileEmail,
  profilePassword,
  profilePasswordConfirm,
  profileLoading,
  profileMessage,
  profileError,
  onProfileEmailChange,
  onProfilePasswordChange,
  onProfilePasswordConfirmChange,
  onUpdateEmail,
  onUpdatePassword,
  isAccountDeleteModalOpen,
  onOpenAccountDeleteModal,
  onCloseAccountDeleteModal,
  onDeleteAccount,
}: AppUIProps) {
  return (
    <div className="app">
      {!isSignedIn ? (
        /* Auth-Ansicht */
        <main className="auth-layout">
          <section className="auth-card">
            <div className="auth-toggle">
              <button
                type="button"
                className={mode === 'login' ? 'tab active' : 'tab'}
                onClick={() => onModeChange('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={mode === 'register' ? 'tab active' : 'tab'}
                onClick={() => onModeChange('register')}
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

            <form className="auth-form" onSubmit={onSubmitAuth} noValidate>
              {mode === 'register' && (
                <label>
                  <span>Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => onNameChange(event.target.value)}
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
                  onChange={(event) => onEmailChange(event.target.value)}
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
                  onChange={(event) => onPasswordChange(event.target.value)}
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
                    onChange={(event) => onPasswordConfirmChange(event.target.value)}
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
        /* Dashboard/Profil-Ansicht */
        <main className="dashboard">
          {/* Topbar */}
          <header className="topbar">
            <div className="topbar-left">
              <button
                className={view === 'dashboard' ? 'chip active' : 'chip'}
                type="button"
                onClick={() => onViewChange('dashboard')}
              >
                Dashboard
              </button>
              <button
                className={view === 'profile' ? 'chip active' : 'chip'}
                type="button"
                onClick={() => onViewChange('profile')}
              >
                Profil
              </button>
            </div>
            <div className="greeting">Hallo {userLabel}!</div>
            <div className="topbar-right">
              <button className="chip" type="button" onClick={onSignOut}>
                Abmelden
              </button>
            </div>
          </header>

          {view === 'dashboard' ? (
            /* Dashboard-Inhalt */
            <section className="dashboard-grid">
              {/* Link-Formular + Übersicht */}
              <article className="card">
                <h2>Verkürzen Sie hier Ihren Link</h2>
                <form className="link-form" onSubmit={onCreateLink}>
                  <label>
                    <span>Ziel-URL</span>
                    <input
                      type="url"
                      value={targetUrl}
                      onChange={(event) => onTargetUrlChange(event.target.value)}
                      placeholder="https://example.com"
                      required
                    />
                  </label>
                  <label>
                    <span>Eigener Kurzname (nur für dich)</span>
                    <input
                      type="text"
                      value={label}
                      onChange={(event) => onLabelChange(event.target.value)}
                      placeholder="Beispiel"
                    />
                  </label>
                  <label>
                    <span>Ablaufzeit</span>
                    <select
                      value={expiresIn}
                      onChange={(event) => onExpiresInChange(event.target.value)}
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
                  <div className="summary-header">Link-Übersicht:</div>
                  <div className="summary-stats">
                    <div>
                      <span>Aktiv</span>
                      <strong>{activeLinksCount}</strong>
                    </div>
                    <div>
                      <span>Abgelaufen</span>
                      <strong>{expiredCount}</strong>
                    </div>
                    <div>
                      <span>Gesamt</span>
                      <strong>{totalLinksCount}</strong>
                    </div>
                  </div>
                </div>
              </article>

              {/* Link-Liste + QR */}
              <article className="card">
                <div className="links-header">
                  <h2>Links</h2>
                  <div className="filter-toggle">
                    <button
                      type="button"
                      className={linkFilter === 'active' ? 'filter-button active' : 'filter-button'}
                      onClick={() => onLinkFilterChange('active')}
                    >
                      Aktiv
                    </button>
                    <button
                      type="button"
                      className={
                        linkFilter === 'expired' ? 'filter-button active' : 'filter-button'
                      }
                      onClick={() => onLinkFilterChange('expired')}
                    >
                      Abgelaufen
                    </button>
                  </div>
                </div>
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
                      onChange={(event) => onSearchChange(event.target.value)}
                      placeholder="z.B. kampagne-jan"
                    />
                  </label>
                </div>
                <div className="links-list">
                  {filteredLinksCount === 0 && !linksLoading ? (
                    <p className="status info">
                      {linkFilter === 'expired'
                        ? 'Keine abgelaufenen Links vorhanden.'
                        : 'Keine aktiven Links vorhanden.'}
                    </p>
                  ) : (
                    pageLinks.map((link) => (
                      <div
                        key={link.id}
                        className={link.id === activeLinkId ? 'link-row active' : 'link-row'}
                        onClick={() => onSelectLink(link.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onSelectLink(link.id);
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
                                onCopyLink(link.shortCode);
                              }}
                            >
                              Kopieren
                            </button>
                            <button
                              type="button"
                              className="delete-inline"
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenDeleteModal(link.id);
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
                {filteredLinksCount > itemsPerPage ? (
                  <div className="pagination">
                    <button type="button" onClick={onPrevPage} disabled={page === 1}>
                      Zurück
                    </button>
                    <span>
                      Seite {page} von {totalPages}
                    </span>
                    <button type="button" onClick={onNextPage} disabled={page === totalPages}>
                      Weiter
                    </button>
                  </div>
                ) : null}
                {expiredCount > 0 && !linksLoading ? (
                  <p className="status info">
                    {expiredCount === 1
                      ? '1 Link ist abgelaufen und wird ausgeblendet.'
                      : `${expiredCount} Links sind abgelaufen und werden ausgeblendet.`}
                  </p>
                ) : null}
                {showQr ? (
                  /* QR-Bereich */
                  <>
                    <div className="qr-box">
                      <p>QR-Code des ausgewählten links</p>
                      {qrDataUrl ? <img src={qrDataUrl} alt="QR Code" /> : null}
                      {!qrDataUrl && activeLinkShortCode ? (
                        <span>{activeLinkShortCode}</span>
                      ) : null}
                    </div>
                    <div className="share-actions">
                      <button
                        className="share-button"
                        type="button"
                        onClick={onShareQr}
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
            /* Profil-Einstellungen */
            <section className="profile-grid">
              <article className="card">
                <h2>Profil-Einstellungen</h2>
                <p className="profile-note">Verwalte deine Login-Daten und dein Konto.</p>
                <div className="profile-section">
                  <h3>E-Mail ändern</h3>
                  <form className="profile-form" onSubmit={onUpdateEmail}>
                    <label>
                      <span>Neue E-Mail</span>
                      <input
                        type="email"
                        autoComplete="email"
                        value={profileEmail}
                        onChange={(event) => onProfileEmailChange(event.target.value)}
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
                  <form className="profile-form" onSubmit={onUpdatePassword}>
                    <label>
                      <span>Neues Passwort</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={profilePassword}
                        onChange={(event) => onProfilePasswordChange(event.target.value)}
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
                        onChange={(event) => onProfilePasswordConfirmChange(event.target.value)}
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
                  <p>Dein Konto und alle Links werden dauerhaft entfernt.</p>
                  <button
                    className="profile-button danger"
                    type="button"
                    onClick={onOpenAccountDeleteModal}
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
        /* Link-Löschbestätigung */
        <div className="modal-backdrop" role="presentation" onClick={onCloseDeleteModal}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-modal-title">Link wirklich löschen?</h3>
            <p>Dieser Schritt kann nicht rückgängig gemacht werden.</p>
            <p className="modal-link">{pendingDeleteUrl}</p>
            <div className="modal-actions">
              <button type="button" className="modal-button ghost" onClick={onCloseDeleteModal}>
                Abbrechen
              </button>
              <button type="button" className="modal-button danger" onClick={onConfirmDelete}>
                Löschen
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isAccountDeleteModalOpen ? (
        /* Konto-Löschbestätigung */
        <div className="modal-backdrop" role="presentation" onClick={onCloseAccountDeleteModal}>
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
                onClick={onCloseAccountDeleteModal}
              >
                Abbrechen
              </button>
              <button type="button" className="modal-button danger" onClick={onDeleteAccount}>
                Konto löschen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AppUI;
