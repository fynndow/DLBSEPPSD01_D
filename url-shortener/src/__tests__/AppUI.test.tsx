import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppUI from '../AppUI';

const baseProps: ComponentProps<typeof AppUI> = {
  isSignedIn: false,
  mode: 'login',
  view: 'dashboard',
  userLabel: 'User',
  loading: false,
  error: null,
  message: null,
  name: '',
  email: '',
  password: '',
  passwordConfirm: '',
  onModeChange: vi.fn(),
  onNameChange: vi.fn(),
  onEmailChange: vi.fn(),
  onPasswordChange: vi.fn(),
  onPasswordConfirmChange: vi.fn(),
  onSubmitAuth: vi.fn(),
  onViewChange: vi.fn(),
  onSignOut: vi.fn(),
  targetUrl: '',
  label: '',
  expiresIn: '1',
  expiryOptions: [{ value: '1', label: 'Default 1 Tag' }],
  onTargetUrlChange: vi.fn(),
  onLabelChange: vi.fn(),
  onExpiresInChange: vi.fn(),
  onCreateLink: vi.fn(),
  linkMessage: null,
  activeLinksCount: 0,
  expiredCount: 0,
  totalLinksCount: 0,
  linkFilter: 'active',
  onLinkFilterChange: vi.fn(),
  linksLoading: false,
  linksError: null,
  searchTerm: '',
  onSearchChange: vi.fn(),
  filteredLinksCount: 0,
  pageLinks: [],
  activeLinkId: null,
  onSelectLink: vi.fn(),
  shortBaseUrl: 'http://localhost:3000/r',
  onCopyLink: vi.fn(),
  copyMessage: null,
  copyError: null,
  deleteMessage: null,
  deleteError: null,
  page: 1,
  totalPages: 1,
  itemsPerPage: 3,
  onPrevPage: vi.fn(),
  onNextPage: vi.fn(),
  showQr: false,
  qrDataUrl: '',
  activeLinkShortCode: null,
  onShareQr: vi.fn(),
  shareMessage: null,
  shareError: null,
  isDeleteModalOpen: false,
  pendingDeleteUrl: '',
  onOpenDeleteModal: vi.fn(),
  onCloseDeleteModal: vi.fn(),
  onConfirmDelete: vi.fn(),
  profileEmail: '',
  profilePassword: '',
  profilePasswordConfirm: '',
  profileLoading: false,
  profileMessage: null,
  profileError: null,
  onProfileEmailChange: vi.fn(),
  onProfilePasswordChange: vi.fn(),
  onProfilePasswordConfirmChange: vi.fn(),
  onUpdateEmail: vi.fn(),
  onUpdatePassword: vi.fn(),
  isAccountDeleteModalOpen: false,
  onOpenAccountDeleteModal: vi.fn(),
  onCloseAccountDeleteModal: vi.fn(),
  onDeleteAccount: vi.fn(),
};

describe('AppUI', () => {
  it('zeigt die Login-Ansicht wenn nicht eingeloggt', () => {
    render(<AppUI {...baseProps} />);
    expect(screen.getByText('Logge dich ein')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Login' })).toBeTruthy();
  });

  it('zeigt den Singular-Text für einen abgelaufenen Link', () => {
    render(
      <AppUI
        {...baseProps}
        isSignedIn
        expiredCount={1}
        totalLinksCount={1}
        view="dashboard"
      />
    );
    expect(
      screen.getByText('1 Link ist abgelaufen und wird ausgeblendet.')
    ).toBeTruthy();
  });

  it('zeigt den Plural-Text für mehrere abgelaufene Links', () => {
    render(
      <AppUI
        {...baseProps}
        isSignedIn
        expiredCount={2}
        totalLinksCount={2}
        view="dashboard"
      />
    );
    expect(
      screen.getByText('2 Links sind abgelaufen und werden ausgeblendet.')
    ).toBeTruthy();
  });
});
