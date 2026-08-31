import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The patient portal's bell was a plain <button> with no onClick and a
 * hardcoded red dot that was always lit. A patient saw a permanent "you have
 * something" marker that opened nothing, while their real notifications —
 * appointment reminders and "your lab report is ready" — sat unread in the
 * database. The API and the read path were both fine; nothing rendered them.
 *
 * These cover the bell a patient now gets, and that its links land in the
 * portal rather than on a hospital screen they cannot open.
 */

// NOTE: no bare vi.mock of `next/navigation` or the auth store here. A bare
// mock replaces the whole module and vitest shares that across every file in
// the worker — doing it broke five unrelated suites. `next/navigation` is
// already mocked in tests/setup.ts, and the auth store is driven through its
// real setState below. Where a notification LINKS to is covered as a pure
// function at the bottom of this file instead of through the router.
const markRead = vi.fn();
const state = { unread: 0, items: [] as unknown[] };
vi.mock('@/hooks/use-notifications', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNotifications: () => ({ data: state.items, isLoading: false }),
  useUnreadNotificationCount: () => ({ data: state.unread }),
  useMarkNotificationRead: () => ({ mutate: markRead }),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn() }),
}));

import { NotificationBell } from './notification-bell';
import { notificationLink } from '@/hooks/use-notifications';
import { useAuthStore } from '@/stores/auth-store';

const REMINDER = {
  id: 'n1',
  title: 'Appointment reminder',
  message: 'You have an appointment tomorrow at 10:00',
  isRead: false,
  referenceType: 'appointment_reminder',
  referenceId: 'appt-1',
  createdAt: new Date().toISOString(),
};
const LAB = { ...REMINDER, id: 'n2', title: 'Your lab report is ready', referenceType: 'lab_report', referenceId: 'lab-1' };

// The auth store is a module singleton shared by every suite in this worker,
// so whatever this file sets stays set for the next one unless it is put back.
// Leaving a patient signed in leaked into record-vitals and four other suites.
const authBefore = useAuthStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  state.unread = 0;
  state.items = [];
  useAuthStore.setState({ user: { roles: ['patient'] } } as never);
});

afterEach(() => {
  useAuthStore.setState(authBefore, true);
});

describe('the notification bell', () => {
  it('shows no badge when there is nothing unread', () => {
    render(<NotificationBell variant="module" />);
    // The old patient bell drew its dot unconditionally, so it always looked
    // like there was something waiting.
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows the real unread count', () => {
    state.unread = 3;
    render(<NotificationBell variant="module" />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('caps a very large count rather than breaking the badge', () => {
    state.unread = 250;
    render(<NotificationBell variant="module" />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('lists the patient’s notifications and marks one read when opened', async () => {
    state.unread = 1;
    state.items = [REMINDER];
    render(<NotificationBell variant="module" />);

    await userEvent.click(screen.getByLabelText('Notifications'));
    await userEvent.click(await screen.findByText('Appointment reminder'));

    expect(markRead).toHaveBeenCalledWith('n1');
  });
});

describe('where a patient notification links to', () => {
  // A patient cannot open a hospital screen, so these must stay in the portal.
  it.each([
    ['appointment_reminder', '/patient-portal/appointments'],
    ['lab_report', '/patient-portal/lab-reports'],
    ['imaging_result', '/patient-portal/imaging-reports'],
    ['prescription', '/patient-portal/prescriptions'],
  ])('%s → %s', (referenceType, expected) => {
    expect(notificationLink({ ...LAB, referenceType } as never, ['patient'])).toBe(expected);
  });
});
