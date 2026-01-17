import type { ComponentProps, FormEvent } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type AppUIComponent from '../AppUI';

type AppUIProps = ComponentProps<typeof AppUIComponent>;

const supabaseMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
}));

const qrcodeMocks = vi.hoisted(() => ({
  toDataURL: vi.fn(),
}));

const uiCapture = vi.hoisted(() => ({
  latestProps: null as AppUIProps | null,
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: supabaseMocks,
  },
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: qrcodeMocks.toDataURL,
  },
}));

vi.mock('../AppUI', () => ({
  default: (props: AppUIProps) => {
    uiCapture.latestProps = props;
    return null;
  },
}));

const getLatestProps = () => {
  if (!uiCapture.latestProps) {
    throw new Error('AppUI props not captured');
  }
  return uiCapture.latestProps;
};

describe('App logic', () => {
  const setup = async () => {
    await act(async () => {
      render(<App />);
    });
    return getLatestProps();
  };

  const submitEvent = { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;

  beforeEach(() => {
    uiCapture.latestProps = null;
    vi.clearAllMocks();
    supabaseMocks.getSession.mockResolvedValue({ data: { session: null } });
    supabaseMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    supabaseMocks.signUp.mockResolvedValue({ error: null });
    supabaseMocks.signInWithPassword.mockResolvedValue({ error: null });
    supabaseMocks.signOut.mockResolvedValue({ error: null });
    supabaseMocks.updateUser.mockResolvedValue({ error: null });
    qrcodeMocks.toDataURL.mockResolvedValue('data:image/png;base64,qr');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fordert eine E-Mail beim Login an', async () => {
    await setup();

    await act(async () => {
      const props = getLatestProps();
      props.onPasswordChange('secret123');
      await props.onSubmitAuth(submitEvent);
    });

    expect(getLatestProps().error).toBe('Bitte eine E-Mail-Adresse eingeben.');
  });

  it('verlangt beim Registrieren einen Namen', async () => {
    await setup();

    await act(async () => {
      const props = getLatestProps();
      props.onModeChange('register');
      props.onEmailChange('user@example.com');
      props.onPasswordChange('secret123');
      props.onPasswordConfirmChange('secret123');
    });

    await act(async () => {
      await getLatestProps().onSubmitAuth(submitEvent);
    });

    expect(getLatestProps().error).toBe('Bitte einen Namen eingeben.');
  });

  it('mappt Supabase-Fehler bei ungültiger E-Mail auf Deutsch', async () => {
    supabaseMocks.signUp.mockResolvedValue({
      error: { message: 'Unable to validate email address: invalid format' },
    });

    await setup();

    await act(async () => {
      const props = getLatestProps();
      props.onModeChange('register');
      props.onNameChange('Test');
      props.onEmailChange('test@invalid');
      props.onPasswordChange('secret123');
      props.onPasswordConfirmChange('secret123');
    });

    await act(async () => {
      await getLatestProps().onSubmitAuth(submitEvent);
    });

    expect(getLatestProps().error).toBe('Bitte eine gültige E-Mail-Adresse eingeben.');
  });

  it('zeigt eine Fehlermeldung bei leerer Ziel-URL', async () => {
    await setup();

    await act(async () => {
      await getLatestProps().onCreateLink(submitEvent);
    });

    expect(getLatestProps().linkMessage).toBe('Bitte gib eine Ziel-URL ein.');
  });

  it('zeigt eine Fehlermeldung bei ungültiger Ziel-URL', async () => {
    await setup();

    await act(async () => {
      getLatestProps().onTargetUrlChange('not-a-url');
    });

    await act(async () => {
      await getLatestProps().onCreateLink(submitEvent);
    });

    expect(getLatestProps().linkMessage).toBe('Die URL ist ungültig.');
  });

  it('erstellt einen Link mit gültigen Daten', async () => {
    const apiLink = {
      id: 'link-1',
      short_code: 'abc123',
      original_url: 'https://example.com',
      expires_at: null,
      click_count: 0,
      label: 'Demo',
    };

    supabaseMocks.getSession.mockResolvedValueOnce({
      data: { session: { access_token: 'token', user: { email: 'user@example.com' } } },
    });

    const fetchMock = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'POST') {
        return {
          ok: true,
          json: async () => apiLink,
        } as Response;
      }

      return {
        ok: true,
        json: async () => [],
      } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    await setup();

    await act(async () => {
      getLatestProps().onTargetUrlChange('https://example.com');
      getLatestProps().onLabelChange('Demo');
    });

    await act(async () => {
      await getLatestProps().onCreateLink(submitEvent);
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeTruthy();
    const [, init] = postCall as [RequestInfo, RequestInit];
    const body = JSON.parse(init.body as string) as {
      originalUrl: string;
      label?: string;
      expiresAt: string | null;
    };

    expect(body.originalUrl).toBe('https://example.com');
    expect(body.label).toBe('Demo');
    expect(body.expiresAt === null || Number.isNaN(Date.parse(body.expiresAt))).toBe(false);
    expect(getLatestProps().linkMessage).toBe('Kurzlink erstellt.');
  });

  it('lädt Links und filtert aktive Links standardmäßig', async () => {
    const now = Date.now();
    const apiLinks = [
      {
        id: 'active-1',
        short_code: 'active',
        original_url: 'https://active.example',
        expires_at: new Date(now + 86400000).toISOString(),
        click_count: 1,
        label: 'Aktiv',
      },
      {
        id: 'expired-1',
        short_code: 'expired',
        original_url: 'https://expired.example',
        expires_at: new Date(now - 86400000).toISOString(),
        click_count: 2,
        label: 'Alt',
      },
    ];

    supabaseMocks.getSession.mockResolvedValueOnce({
      data: { session: { access_token: 'token', user: { email: 'user@example.com' } } },
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => apiLinks,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await setup();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(getLatestProps().totalLinksCount).toBe(2);
    });

    const props = getLatestProps();
    expect(props.activeLinksCount).toBe(1);
    expect(props.expiredCount).toBe(1);
    expect(props.filteredLinksCount).toBe(1);
  });

  it('löscht einen Link und aktualisiert die Liste', async () => {
    const apiLinks = [
      {
        id: 'delete-1',
        short_code: 'delete',
        original_url: 'https://delete.example',
        expires_at: null,
        click_count: 0,
        label: 'Zum Löschen',
      },
    ];

    supabaseMocks.getSession.mockResolvedValueOnce({
      data: { session: { access_token: 'token', user: { email: 'user@example.com' } } },
    });

    const fetchMock = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'DELETE') {
        return { ok: true, json: async () => ({}) } as Response;
      }
      return { ok: true, json: async () => apiLinks } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    await setup();

    await waitFor(() => {
      expect(getLatestProps().totalLinksCount).toBe(1);
    });

    await act(async () => {
      getLatestProps().onOpenDeleteModal('delete-1');
    });

    expect(getLatestProps().isDeleteModalOpen).toBe(true);

    await act(async () => {
      await getLatestProps().onConfirmDelete();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(getLatestProps().totalLinksCount).toBe(0);
    });

    expect(getLatestProps().deleteMessage).toBe('Link gelöscht.');
    await waitFor(() => {
      expect(getLatestProps().isDeleteModalOpen).toBe(false);
    });
  });

  it('filtert Links nach Status und Suchbegriff', async () => {
    const now = Date.now();
    const apiLinks = [
      {
        id: 'alpha-1',
        short_code: 'alpha',
        original_url: 'https://alpha.example',
        expires_at: new Date(now + 86400000).toISOString(),
        click_count: 0,
        label: 'alpha',
      },
      {
        id: 'beta-1',
        short_code: 'beta',
        original_url: 'https://beta.example',
        expires_at: new Date(now + 86400000).toISOString(),
        click_count: 0,
        label: 'beta',
      },
      {
        id: 'old-1',
        short_code: 'old',
        original_url: 'https://old.example',
        expires_at: new Date(now - 86400000).toISOString(),
        click_count: 0,
        label: 'old',
      },
    ];

    supabaseMocks.getSession.mockResolvedValueOnce({
      data: { session: { access_token: 'token', user: { email: 'user@example.com' } } },
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => apiLinks,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await setup();

    await waitFor(() => {
      expect(getLatestProps().activeLinksCount).toBe(2);
    });

    await act(async () => {
      getLatestProps().onSearchChange('beta');
    });

    await waitFor(() => {
      expect(getLatestProps().filteredLinksCount).toBe(1);
    });

    await act(async () => {
      getLatestProps().onSearchChange('');
      getLatestProps().onLinkFilterChange('expired');
    });

    await waitFor(() => {
      expect(getLatestProps().filteredLinksCount).toBe(1);
      expect(getLatestProps().linkFilter).toBe('expired');
    });
  });

  it('blendet QR im abgelaufen-Tab aus und meldet fehlenden QR-Code', async () => {
    const apiLinks = [
      {
        id: 'qr-1',
        short_code: 'qr',
        original_url: 'https://qr.example',
        expires_at: null,
        click_count: 0,
        label: 'QR',
      },
    ];

    supabaseMocks.getSession.mockResolvedValueOnce({
      data: { session: { access_token: 'token', user: { email: 'user@example.com' } } },
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => apiLinks,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await setup();

    await waitFor(() => {
      expect(getLatestProps().showQr).toBe(true);
    });

    await act(async () => {
      getLatestProps().onLinkFilterChange('expired');
    });

    await waitFor(() => {
      expect(getLatestProps().showQr).toBe(false);
      expect(getLatestProps().qrDataUrl).toBe('');
    });

    await act(async () => {
      await getLatestProps().onShareQr();
    });

    expect(getLatestProps().shareError).toBe('Kein QR-Code vorhanden.');
  });
});
