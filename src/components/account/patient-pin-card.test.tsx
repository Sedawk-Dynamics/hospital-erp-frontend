import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
vi.mock('@/lib/api', () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiPost: (...a: unknown[]) => apiPost(...a),
  apiPut: (...a: unknown[]) => apiPut(...a),
  apiDelete: (...a: unknown[]) => apiDelete(...a),
}));

import { PatientPinCard } from './patient-pin-card';

const row = (id: string, label: string, locked = false) => ({
  id, label, locked, createdAt: '2026-11-20T06:00:00Z', lastUsedAt: '2026-11-25T06:00:00Z',
});
const stored = () => JSON.parse(localStorage.getItem('patientDevice') ?? 'null');

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PatientPinCard name="Asha" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  apiGet.mockResolvedValue({ data: { devices: [] } });
  apiDelete.mockResolvedValue({ data: null });
});

describe('PatientPinCard', () => {
  it('sets a PIN on this device after a code', async () => {
    apiPost.mockImplementation(async (url: string) =>
      url === '/auth/me/pin/code'
        ? { data: { channel: 'sms', sentTo: '+91 ******0011', expiresInSeconds: 300, resendInSeconds: 60 } }
        : { data: { deviceId: 'dev-1', deviceToken: 'tok-1' } },
    );
    renderCard();
    expect(await screen.findByText('No device has a PIN.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /set a pin on this device/i }));
    expect(await screen.findByTestId('pin-code-sent')).toHaveTextContent('+91 ******0011');
    await userEvent.type(screen.getByLabelText('Code'), '731904');
    await userEvent.type(screen.getByLabelText('New PIN'), '480193');
    await userEvent.type(screen.getByLabelText('New PIN again'), '480193');
    await userEvent.click(screen.getByRole('button', { name: 'Set PIN' }));
    await waitFor(() => expect(stored()).toEqual({ deviceId: 'dev-1', deviceToken: 'tok-1', name: 'Asha' }));
    expect(apiPost).toHaveBeenLastCalledWith('/auth/me/pin', { pin: '480193', code: '731904' });
  });

  it('changes the PIN of this device and marks it locked when the server does', async () => {
    localStorage.setItem('patientDevice', JSON.stringify({ deviceId: 'dev-1', deviceToken: 'tok-1' }));
    apiGet.mockResolvedValue({ data: { devices: [row('dev-1', 'Chrome on Android'), row('dev-2', 'Safari on Mac', true)] } });
    renderCard();
    expect(await screen.findByText('This device')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Change PIN' }));
    await userEvent.type(screen.getByLabelText('Current PIN'), '480193');
    await userEvent.type(screen.getByLabelText('New PIN'), '730264');
    await userEvent.type(screen.getByLabelText('New PIN again'), '730264');
    apiPut.mockRejectedValue({ response: { data: { code: 'PIN_LOCKED', message: 'Too many wrong PINs. Sign in with a code instead.' } } });
    await userEvent.click(screen.getByRole('button', { name: 'Change PIN' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many wrong PINs');
    expect(apiPut).toHaveBeenCalledWith('/auth/me/pin', { deviceToken: 'tok-1', currentPin: '480193', newPin: '730264' });
    expect(stored()).toMatchObject({ locked: true });
  });

  it('removes another device without forgetting this one, and this one or all with forgetting', async () => {
    localStorage.setItem('patientDevice', JSON.stringify({ deviceId: 'dev-1', deviceToken: 'tok-1' }));
    apiGet.mockResolvedValue({ data: { devices: [row('dev-1', 'Chrome on Android'), row('dev-2', 'Safari on Mac')] } });
    renderCard();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Safari on Mac' }));
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/auth/me/pin/devices/dev-2'));
    expect(stored()).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Chrome on Android' }));
    await waitFor(() => expect(stored()).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: /remove all devices/i }));
    await waitFor(() => expect(apiDelete).toHaveBeenLastCalledWith('/auth/me/pin/devices'));
  });

  it('offers Retry when the devices do not load', async () => {
    apiGet.mockRejectedValueOnce(new Error('down'));
    renderCard();
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No device has a PIN.')).toBeInTheDocument();
  });
});
