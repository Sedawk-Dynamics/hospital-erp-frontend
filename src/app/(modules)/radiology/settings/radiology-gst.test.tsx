import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

// #358: a study's GST is "not set" until the finance / GST admin approves it.

const canManage = vi.fn(() => true);
const approveDiagnostic = vi.fn();
const setApproval = vi.fn();
const create = vi.fn();
let rows: any[] = [];

vi.mock('@/hooks/use-gst-portal', () => ({ useCanManageGst: () => canManage() }));
vi.mock('@/hooks/use-gst-slabs', () => ({ useGstSlabs: () => ({ data: { slabs: [0, 5, 18].map((r) => ({ ratePercent: r, current: true })) } }) }));
vi.mock('@/components/radiology/radiology-admin-guard', () => ({ RadiologyAdminGuard: ({ children }: any) => <>{children}</> }));
vi.mock('@/hooks/use-service-tariffs', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/hooks/use-service-tariffs')>();
  return {
    ...real,
    useServiceTariffs: () => ({ data: { data: rows }, isLoading: false, refetch: vi.fn() }),
    useCreateServiceTariff: () => ({ mutateAsync: create, isPending: false }),
    useUpdateServiceTariff: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteServiceTariff: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useApproveRadiologyDiagnostic: () => ({ mutateAsync: approveDiagnostic, isPending: false }),
    useSetTariffGstApproval: () => ({ mutateAsync: setApproval, isPending: false }),
  };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select value={value ?? ''} onChange={(e) => onValueChange(e.target.value)}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

import { toast } from 'sonner';
import RadiologySettingsPage from './page';

const study = (o: Record<string, unknown>) => ({
  id: 'x', serviceName: 'Study', serviceCode: 'x', category: 'radiology', basePrice: 1000, gstRatePercent: 0, sacCode: null,
  gstTreatment: null, gstApproved: false, isCosmetic: false, isActive: true, ...o,
});
const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  canManage.mockReturnValue(true);
  approveDiagnostic.mockResolvedValue({ approved: [{ id: 'a', serviceName: 'CT' }], skipped: [] });
  create.mockResolvedValue({});
  rows = [
    study({ id: 'a', serviceName: 'CT' }),
    study({ id: 'b', serviceName: 'MRI', gstTreatment: 'exempt', gstApproved: true }),
    study({ id: 'c', serviceName: 'Keepsake', isCosmetic: true, gstTreatment: 'taxable', gstRatePercent: 18, sacCode: '999799' }),
    study({ id: 'd', serviceName: 'Old', gstTreatment: 'taxable', gstRatePercent: 12 }),
  ];
});

describe('radiology settings GST (#358)', () => {
  it('shows "GST not set" until approved — never 0% — and the approved rate after', () => {
    render(<RadiologySettingsPage />);
    expect(within(rowOf('CT')).getByText('GST not set')).toBeInTheDocument();
    expect(within(rowOf('MRI')).getByText('0% (exempt)')).toBeInTheDocument();
    expect(within(rowOf('Keepsake')).getByText('GST not set')).toBeInTheDocument();
    expect(within(rowOf('Keepsake')).getByText(/18% entered, awaiting approval/)).toBeInTheDocument();
    expect(within(rowOf('Keepsake')).getByText('Cannot be billed yet')).toBeInTheDocument();
    expect(within(rowOf('Old')).getByText('GST not set')).toBeInTheDocument();
  });

  it('approves only what is ticked, and says why a row was not approved', async () => {
    approveDiagnostic.mockResolvedValue({ approved: [{ id: 'a', serviceName: 'CT' }], skipped: [{ id: 'd', serviceName: 'Old', reason: 'A diagnostic scan is exempt (0%).' }] });
    render(<RadiologySettingsPage />);
    const bulk = screen.getByRole('button', { name: /Approve selected as diagnostic 0%/ });
    expect(bulk).toBeDisabled();
    // Nothing is ticked for them, and a cosmetic study cannot be ticked at all.
    expect(screen.queryByLabelText('Select Keepsake')).toBeNull();
    fireEvent.click(screen.getByLabelText('Select CT'));
    fireEvent.click(screen.getByLabelText('Select Old'));
    await act(async () => fireEvent.click(bulk));
    expect(approveDiagnostic).toHaveBeenCalledWith(['a', 'd']);
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('Old not approved'), expect.anything());
  });

  it('a cosmetic study is approved on its own rate', async () => {
    render(<RadiologySettingsPage />);
    await act(async () => fireEvent.click(within(rowOf('Keepsake')).getByRole('button', { name: /Approve 18%/ })));
    expect(setApproval).toHaveBeenCalledWith({ id: 'c', approved: true });
    expect(approveDiagnostic).not.toHaveBeenCalled();
  });

  it('only the finance / GST admin sees the approvals', () => {
    canManage.mockReturnValue(false);
    render(<RadiologySettingsPage />);
    expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull();
    expect(screen.queryByLabelText('Select CT')).toBeNull();
  });

  it('a cosmetic study cannot be saved without a rate and a SAC; there is no default', async () => {
    render(<RadiologySettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Add Modality/ }));
    fireEvent.change(screen.getByPlaceholderText(/MRI, CT Scan/), { target: { value: 'Face 3D' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '500' } });
    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'cosmetic' } });
    expect((screen.getAllByRole('combobox')[1] as HTMLSelectElement).value).toBe('');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(create).not.toHaveBeenCalled();
    fireEvent.change(screen.getAllByRole('combobox')[1]!, { target: { value: '18' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(create).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/SAC/), { target: { value: '999799' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ isCosmetic: true, gstTreatment: 'taxable', taxRate: 18, sacCode: '999799' }));
  });
});
