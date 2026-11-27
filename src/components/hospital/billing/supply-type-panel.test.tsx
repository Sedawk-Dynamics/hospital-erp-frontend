import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

// #265: the place of supply is the hospital unless billing / admin says otherwise.

const canManage = vi.fn(() => true);
const save = vi.fn();
vi.mock('@/hooks/use-gst-portal', () => ({ useCanManageGst: () => canManage() }));
vi.mock('@/hooks/use-hospital', () => ({ useSetBillSupplyType: () => ({ mutateAsync: save, isPending: false }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// A native select stands in for the popup: what matters here is which value goes out.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, disabled, children }: any) => (
    <select value={value ?? ''} disabled={disabled} onChange={(e) => onValueChange(e.target.value)}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

import { SupplyTypePanel } from './supply-type-panel';

const draft = { id: 'b1', status: 'draft', invoiceNumber: null, supplyType: 'performed_at_hospital' };
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Change' }));
const selects = () => screen.getAllByRole('combobox') as HTMLSelectElement[];

beforeEach(() => {
  vi.clearAllMocks();
  canManage.mockReturnValue(true);
  save.mockResolvedValue({});
});

describe('SupplyTypePanel (#265)', () => {
  it('says the hospital, whoever the buyer is', () => {
    render(<SupplyTypePanel bill={{ ...draft, recipientGstin: '27AAPFU0939F1ZV' }} />);
    expect(screen.getByText(/CGST \+ SGST, whoever the buyer is/)).toBeInTheDocument();
  });

  it('is read-only without the billing / admin role, and once issued', () => {
    canManage.mockReturnValue(false);
    const { rerender } = render(<SupplyTypePanel bill={draft} />);
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
    canManage.mockReturnValue(true);
    rerender(<SupplyTypePanel bill={{ ...draft, status: 'pending', invoiceNumber: 'INV/1', isInterState: true, placeOfSupplyStateCode: '27' }} />);
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
    expect(screen.getByText(/Maharashtra — issued with IGST/)).toBeInTheDocument();
  });

  it('needs a destination and a reason for shipped goods, then sends both', async () => {
    render(<SupplyTypePanel bill={draft} />);
    open();
    fireEvent.change(selects()[0]!, { target: { value: 'goods_shipped' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText('Choose the destination state.')).toBeInTheDocument();
    fireEvent.change(selects()[1]!, { target: { value: '29' } });
    expect(screen.getByText('Give the reason.')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Implants/), { target: { value: 'Couriered to Bengaluru' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(save).toHaveBeenCalledWith({ id: 'b1', supplyType: 'goods_shipped', destinationStateCode: '29', reason: 'Couriered to Bengaluru' });
  });

  it('takes an off-site service to its buyer’s own state, and asks for the GSTIN first', async () => {
    const { unmount } = render(<SupplyTypePanel bill={draft} />);
    open();
    fireEvent.change(selects()[0]!, { target: { value: 'off_site_service' } });
    expect(screen.getByText("Add the buyer's GSTIN first.")).toBeInTheDocument();
    unmount();

    render(<SupplyTypePanel bill={{ ...draft, recipientGstin: '27AAPFU0939F1ZV' }} />);
    open();
    fireEvent.change(selects()[0]!, { target: { value: 'off_site_service' } });
    expect(selects()[1]).toBeDisabled();
    expect(selects()[1]!.value).toBe('27');
    fireEvent.change(screen.getByPlaceholderText(/Implants/), { target: { value: 'Site audit' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ supplyType: 'off_site_service', destinationStateCode: '27' }));
  });

  it('back to the hospital clears the destination', async () => {
    render(<SupplyTypePanel bill={{ ...draft, supplyType: 'goods_shipped', supplyDestinationStateCode: '29', supplyTypeReason: 'x' }} />);
    expect(screen.getByText(/Goods shipped to another place — Karnataka/)).toBeInTheDocument();
    open();
    fireEvent.change(selects()[0]!, { target: { value: 'performed_at_hospital' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ supplyType: 'performed_at_hospital', destinationStateCode: null }));
  });
});
