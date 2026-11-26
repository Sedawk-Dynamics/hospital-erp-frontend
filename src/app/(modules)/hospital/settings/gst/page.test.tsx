import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';

// G-5 (gap #266): the e-invoice / e-way switches are disabled and read
// "Not available" until the integration is ready, and are never shown as
// active while it is not — even when the saved setting says they are on.

const profile = vi.fn();
const mutateAsync = vi.fn();
const portalStatus = vi.fn();

vi.mock('@/hooks/use-gst-profile', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/hooks/use-gst-profile')>();
  return {
    ...real,
    useGstProfile: () => profile(),
    useUpdateGstProfile: () => ({ mutateAsync, isPending: false }),
    useGstinVerificationProvider: () => ({ data: undefined }),
    useVerifyGstin: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});

vi.mock('@/hooks/use-gst-portal', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/hooks/use-gst-portal')>();
  return { ...real, useGstPortalStatus: () => portalStatus() };
});

// The credentials card has its own data needs; this test is about the switches.
vi.mock('@/components/hospital/gst/gst-portal-settings', () => ({
  GstPortalSettingsCard: () => null,
  ReadinessChip: ({ ready }: { ready: boolean }) => <span>{ready ? 'Ready' : 'Not available'}</span>,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import GstRegistrationPage from './page';
import { EMPTY_GST_PROFILE } from '@/hooks/use-gst-profile';

const readiness = (ready: boolean) => ({
  ready,
  reason: ready ? null : 'No e-invoice / e-way bill provider (GSP) is configured on this server',
});

function setup(saved: Partial<typeof EMPTY_GST_PROFILE>, ready: boolean) {
  profile.mockReturnValue({ data: { ...EMPTY_GST_PROFILE, registered: true, gstin: null, ...saved }, isLoading: false });
  portalStatus.mockReturnValue({ data: { einvoice: readiness(ready), eway: readiness(ready) } });
  render(<GstRegistrationPage />);
  const einv = screen.getByText('E-invoicing applies').closest('label')!.querySelector('input')!;
  const eway = screen.getByText('E-way bills apply').closest('label')!.querySelector('input')!;
  return { einv, eway };
}

beforeEach(() => {
  vi.clearAllMocks();
  mutateAsync.mockImplementation(async (p) => ({ ...EMPTY_GST_PROFILE, ...p }));
});

describe('GST settings — e-invoice / e-way switches', () => {
  it('disables both and labels them Not available when the integration is not ready', () => {
    const { einv, eway } = setup({}, false);
    expect(einv.disabled).toBe(true);
    expect(eway.disabled).toBe(true);
    expect(screen.getAllByText('Not available').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/No e-invoice \/ e-way bill provider/).length).toBeGreaterThanOrEqual(1);
  });

  it('never shows a switch as active when it is on in data but not ready, and does not send it on save', async () => {
    const { einv, eway } = setup({ eInvoiceApplicable: true, eWayBillApplicable: true }, false);
    expect(einv.checked).toBe(false);
    expect(eway.checked).toBe(false);
    expect(screen.getByText(/saved setting says e-invoicing applies, but it is inactive/)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    });
    const sent = mutateAsync.mock.calls[0][0];
    expect('eInvoiceApplicable' in sent).toBe(false);
    expect('eWayBillApplicable' in sent).toBe(false);
  });

  it('enables the switches once ready', () => {
    const { einv, eway } = setup({ eInvoiceApplicable: true }, true);
    expect(einv.disabled).toBe(false);
    expect(einv.checked).toBe(true);
    expect(eway.disabled).toBe(false);
    expect(eway.checked).toBe(false);
  });
});
