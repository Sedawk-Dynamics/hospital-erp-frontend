import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mock the transport ───
const mockGet = vi.fn();
const mockPatch = vi.fn();
vi.mock('@/lib/api-client', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/hospital',
}));

import { NotificationBell } from '@/components/layout/notification-bell';

const NOW = new Date().toISOString();

function notification(over: Record<string, unknown> = {}) {
  return {
    id: 'n1',
    title: 'Surgery scheduled',
    message: 'Appendectomy at 14:00',
    notificationType: 'system',
    referenceType: 'ot_scheduled',
    referenceId: null,
    isRead: false,
    createdAt: NOW,
    ...over,
  };
}

function renderBell() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <NotificationBell />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockImplementation((url: string) => {
    if (url.includes('unread-count')) {
      return Promise.resolve({ data: { data: { unreadCount: 1 } } });
    }
    // Both the dropdown (array) and the panel (paginated) read this path.
    return Promise.resolve({
      data: { data: [notification()], meta: { total: 1 } },
    });
  });
});

describe('NotificationBell → full history panel', () => {
  // The bell only ever holds the most recent handful. "See all" used to
  // navigate to a page, which threw away whatever screen the user was on.
  it('opens the history in a panel instead of navigating away', async () => {
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByLabelText('Notifications'));
    const seeAll = await screen.findByText('See all notifications');
    await user.click(seeAll);

    // The search box only exists in the panel body, so finding it proves the
    // full history actually mounted — not merely that some dialog opened.
    expect(await screen.findByPlaceholderText('Search notifications…')).toBeInTheDocument();
    // And crucially the router was never used: the page behind is untouched.
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('closes the dropdown when the panel opens', async () => {
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByLabelText('Notifications'));
    await user.click(await screen.findByText('See all notifications'));

    // A floating menu left on top of the slide-over reads as broken.
    await waitFor(() =>
      expect(screen.queryByText('See all notifications')).not.toBeInTheDocument(),
    );
  });

  it('shows the unread count on the bell', async () => {
    renderBell();
    expect(await screen.findByText('1')).toBeInTheDocument();
  });
});
