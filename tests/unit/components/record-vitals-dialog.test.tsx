import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mock apiClient (apiPost in @/lib/api delegates to it) ───
const mockPost = vi.fn();
vi.mock('@/lib/api-client', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: (...args: unknown[]) => mockPost(...args),
    delete: vi.fn(),
  },
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

import { RecordVitalsDialog } from '@/components/shared/record-vitals-dialog';

const PATIENT = '11111111-1111-4111-8111-111111111111';
const VISIT = '22222222-2222-4222-8222-222222222222';

function renderDialog(props: Partial<React.ComponentProps<typeof RecordVitalsDialog>> = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <RecordVitalsDialog
        open
        onOpenChange={() => {}}
        patientId={PATIENT}
        visitId={VISIT}
        {...props}
      />
    </QueryClientProvider>,
  );
}

async function type(label: RegExp, value: string) {
  const input = screen.getByLabelText(label);
  await userEvent.clear(input);
  await userEvent.type(input, value);
}

function bodyOf(call: unknown[]): Record<string, unknown> {
  return call[1] as Record<string, unknown>;
}

describe('RecordVitalsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ data: { data: { id: 'vital-1' } } });
  });

  // The consultation surfaces pass `appointmentId={appointmentId || ''}` down
  // through required-string props. That empty string is not a missing key — the
  // server parses it as a uuid and answers a flat 400, which is exactly what
  // "Request failed with status code 400" was.
  it('does not send an encounter id that arrived blank', async () => {
    renderDialog({ appointmentId: '' });

    await type(/Pulse/i, '72');
    await userEvent.click(screen.getByRole('button', { name: /Save Vitals/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    const body = bodyOf(mockPost.mock.calls[0]);
    expect(body.visitId).toBe(VISIT);
    expect(body.appointmentId).toBeUndefined();
  });

  it('refuses to submit when every encounter id is blank', async () => {
    renderDialog({ visitId: '', appointmentId: '  ' });

    await type(/Pulse/i, '72');
    await userEvent.click(screen.getByRole('button', { name: /Save Vitals/i }));

    expect(mockPost).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining('No visit, admission or appointment context'),
    );
  });

  it('converts a temperature entered in °F, so 98.6 is not a 400', async () => {
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: '°F' }));
    await type(/Temperature/i, '98.6');
    await userEvent.click(screen.getByRole('button', { name: /Save Vitals/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(bodyOf(mockPost.mock.calls[0]).temperature).toBe(37);
  });

  it('names the offending field instead of letting the server 400', async () => {
    renderDialog();

    await type(/Temperature/i, '98.6'); // still on °C
    await userEvent.click(screen.getByRole('button', { name: /Save Vitals/i }));

    expect(mockPost).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining('Temperature must be between 25 and 50'),
    );
  });

  it('rejects a decimal where the server demands a whole number', async () => {
    renderDialog();

    await type(/Pulse/i, '72.5');
    await userEvent.click(screen.getByRole('button', { name: /Save Vitals/i }));

    expect(mockPost).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining('Pulse must be a whole number'),
    );
  });

  it('sends a normal reading through untouched', async () => {
    renderDialog();

    await type(/Temperature/i, '36.6');
    await type(/BP Systolic/i, '120');
    await userEvent.click(screen.getByRole('button', { name: /Save Vitals/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(bodyOf(mockPost.mock.calls[0])).toMatchObject({
      patientId: PATIENT,
      visitId: VISIT,
      temperature: 36.6,
      bloodPressureSystolic: 120,
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Vitals recorded');
  });
});
