import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mock the transport ───
const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('@/lib/api-client', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { CommunicationLogPanel } from '@/components/insurance/communication-log-panel';

const NOW = new Date().toISOString();

function logEntry(over: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    claimId: 'claim-1',
    preAuthId: null,
    tpaId: 'tpa-1',
    communicationType: 'portal',
    direction: 'outbound',
    subject: 'Claim CLM-1 submitted for review',
    content: 'Claim of 10000.00 sent to the insurer for review.',
    isSystem: true,
    createdAt: NOW,
    claim: { id: 'claim-1', claimNumber: 'CLM-1', status: 'submitted' },
    preAuth: null,
    tpa: { id: 'tpa-1', name: 'MediClaim TPA' },
    communicator: { id: 'u1', firstName: 'Asha', lastName: 'Menon' },
    ...over,
  };
}

function renderPanel(props: { claimId?: string; preAuthId?: string } = { claimId: 'claim-1' }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <CommunicationLogPanel {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ data: { data: [logEntry()], meta: { total: 1 } } });
  mockPost.mockResolvedValue({ data: { data: logEntry({ id: 'log-2', isSystem: false }) } });
});

describe('CommunicationLogPanel', () => {
  it('lists what has passed between the hospital and the insurer', async () => {
    renderPanel();

    await waitFor(() =>
      expect(screen.getByText('Claim CLM-1 submitted for review')).toBeInTheDocument(),
    );
    expect(screen.getByText(/sent to the insurer for review/)).toBeInTheDocument();
  });

  it('marks an entry the system wrote so it is not read as somebody’s note', async () => {
    renderPanel();

    await waitFor(() => expect(screen.getByText('Automatic')).toBeInTheDocument());
  });

  it('labels a hand-written entry by how it happened instead', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [logEntry({ isSystem: false, communicationType: 'phone', subject: 'Called them' })],
        meta: { total: 1 },
      },
    });
    renderPanel();

    await waitFor(() => expect(screen.getByText('Phone call')).toBeInTheDocument());
    expect(screen.queryByText('Automatic')).not.toBeInTheDocument();
  });

  it('names the person who recorded it without printing "null" for a missing surname', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [logEntry({ communicator: { id: 'u2', firstName: 'Temporary', lastName: null } })],
        meta: { total: 1 },
      },
    });
    renderPanel();

    await waitFor(() => expect(screen.getByText(/Temporary/)).toBeInTheDocument());
    expect(screen.queryByText(/null/i)).not.toBeInTheDocument();
  });

  it('asks the server for this claim only', async () => {
    renderPanel({ claimId: 'claim-99' });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const [, config] = mockGet.mock.calls[0];
    expect(config?.params).toMatchObject({ claimId: 'claim-99' });
  });

  it('scopes itself to a pre-authorization when given one', async () => {
    renderPanel({ preAuthId: 'preauth-7' });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const [, config] = mockGet.mock.calls[0];
    expect(config?.params).toMatchObject({ preAuthId: 'preauth-7' });
  });

  it('says what to do when nothing has been recorded yet', async () => {
    mockGet.mockResolvedValue({ data: { data: [], meta: { total: 0 } } });
    renderPanel();

    await waitFor(() =>
      expect(screen.getByText(/Nothing recorded yet/)).toBeInTheDocument(),
    );
  });

  it('sends the claim it belongs to when a call is logged by hand', async () => {
    const user = userEvent.setup();
    renderPanel({ claimId: 'claim-1' });

    await waitFor(() => expect(screen.getByText(/Log communication/)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Log communication/ }));

    const subject = await screen.findByPlaceholderText(/Chased the settlement/);
    await user.type(subject, 'Rang the claims desk');
    await user.click(screen.getByRole('button', { name: /Save entry/ }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/insurance/tpa-logs');
    expect(body).toMatchObject({
      claimId: 'claim-1',
      subject: 'Rang the claims desk',
      direction: 'outbound',
      communicationType: 'phone',
    });
  });

  it('refuses to save an entry with no subject', async () => {
    const user = userEvent.setup();
    renderPanel();

    await waitFor(() => expect(screen.getByText(/Log communication/)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Log communication/ }));
    await screen.findByPlaceholderText(/Chased the settlement/);
    await user.click(screen.getByRole('button', { name: /Save entry/ }));

    expect(mockPost).not.toHaveBeenCalled();
  });
});
