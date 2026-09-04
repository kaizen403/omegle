import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MaintenanceGuard } from '../MaintenanceGuard';
import { useMaintenanceStatus } from '@/hooks/useMaintenanceStatus';

const navigation = vi.hoisted(() => ({
  pathname: '/welcome',
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace, push: vi.fn(), prefetch: vi.fn() }),
}));

interface StatusBody {
  maintenance: boolean;
  message?: string | null;
}

const okResponse = (body: StatusBody) => ({ ok: true, json: async () => body });

const mockStatus = (...bodies: StatusBody[]) => {
  const fetchMock = vi.fn();
  bodies.forEach((body, index) => {
    // Last body sticks, so the polling interval keeps getting an answer.
    if (index === bodies.length - 1) fetchMock.mockResolvedValue(okResponse(body));
    else fetchMock.mockResolvedValueOnce(okResponse(body));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

function App() {
  return <p>Real app</p>;
}

function StatusProbe() {
  const { maintenance, message } = useMaintenanceStatus();
  return <p>{`${maintenance ? 'paused' : 'open'}:${message ?? 'no message'}`}</p>;
}

describe('MaintenanceGuard', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'https://api.test');
    navigation.pathname = '/welcome';
    navigation.replace.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('renders the app once /status reports no maintenance', async () => {
    mockStatus({ maintenance: false, message: null });

    render(
      <MaintenanceGuard>
        <App />
      </MaintenanceGuard>
    );

    expect(await screen.findByText('Real app')).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('hides the app and redirects to /maintenance when /status reports maintenance', async () => {
    mockStatus({ maintenance: true, message: 'Back at 2 AM IST' });

    render(
      <MaintenanceGuard>
        <App />
      </MaintenanceGuard>
    );

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/maintenance'));
    expect(screen.queryByText('Real app')).not.toBeInTheDocument();
  });

  it('fails open when the status request rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    render(
      <MaintenanceGuard>
        <App />
      </MaintenanceGuard>
    );

    expect(await screen.findByText('Real app')).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('fails open when the status request returns a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) })
    );

    render(
      <MaintenanceGuard>
        <App />
      </MaintenanceGuard>
    );

    expect(await screen.findByText('Real app')).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('fails open when no backend URL is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', '');
    const fetchMock = mockStatus({ maintenance: true });

    render(
      <MaintenanceGuard>
        <App />
      </MaintenanceGuard>
    );

    expect(await screen.findByText('Real app')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends visitors on /maintenance back to /welcome once maintenance clears', async () => {
    navigation.pathname = '/maintenance/'; // trailingSlash: true
    mockStatus({ maintenance: false, message: null });

    render(
      <MaintenanceGuard>
        <App />
      </MaintenanceGuard>
    );

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/welcome'));
  });

  it('keeps allowed paths rendered and does not redirect while maintenance is on', async () => {
    navigation.pathname = '/terms';
    mockStatus({ maintenance: true, message: null });

    render(
      <MaintenanceGuard>
        <App />
      </MaintenanceGuard>
    );

    expect(screen.getByText('Real app')).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('publishes the operator message through context', async () => {
    navigation.pathname = '/maintenance';
    mockStatus({ maintenance: true, message: 'Upgrading the matchmaker, back by 2 AM.' });

    render(
      <MaintenanceGuard>
        <StatusProbe />
      </MaintenanceGuard>
    );

    expect(
      await screen.findByText('paused:Upgrading the matchmaker, back by 2 AM.')
    ).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('re-checks when the tab becomes visible again', async () => {
    mockStatus({ maintenance: false, message: null }, { maintenance: true, message: null });

    render(
      <MaintenanceGuard>
        <App />
      </MaintenanceGuard>
    );

    expect(await screen.findByText('Real app')).toBeInTheDocument();

    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/maintenance'));
  });

  it('re-checks when the browser comes back online', async () => {
    const fetchMock = mockStatus(
      { maintenance: false, message: null },
      { maintenance: true, message: null }
    );

    render(
      <MaintenanceGuard>
        <App />
      </MaintenanceGuard>
    );

    expect(await screen.findByText('Real app')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('online'));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/maintenance'));
  });
});
