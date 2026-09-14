import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const create = { mutateAsync: vi.fn(), isPending: false };
const update = { mutateAsync: vi.fn(), isPending: false };

vi.mock('@/hooks/use-inventory', () => ({
  useCreateUnifiedStock: () => create,
}));
vi.mock('@/hooks/use-pharmacy', () => ({
  useUpdateFormularyItem: () => update,
}));
vi.mock('@/hooks/use-drug-master', () => ({
  useHsnGstRates: () => ({ data: [{ hsnCode: '3924', gstRate: 18, description: 'Plastic articles' }] }),
  matchHsnGstRate: (code: string) =>
    code.startsWith('3924') ? { hsnCode: '3924', gstRate: 18, description: 'Plastic articles' } : null,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ProductFormDialog } from './product-form-dialog';

describe('ProductFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mutateAsync.mockResolvedValue({ status: 'created', item: { id: 'p1' } });
  });

  it('uses the retail-product payload and contains no medicine fields', async () => {
    render(<ProductFormDialog open onOpenChange={vi.fn()} />);

    expect(screen.queryByText(/salt composition/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dosage form/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Product Name *'), { target: { value: 'Baby Bottle' } });
    fireEvent.change(screen.getByLabelText('Product Category *'), { target: { value: 'Baby Care' } });
    fireEvent.change(screen.getByLabelText('Unit of Sale *'), { target: { value: 'Piece' } });
    fireEvent.change(screen.getByLabelText('HSN Code *'), { target: { value: '3924' } });
    fireEvent.change(screen.getByLabelText('Selling Price / Unit (₹) *'), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText('Opening Stock'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Product' }));

    await waitFor(() => expect(create.mutateAsync).toHaveBeenCalledOnce());
    expect(create.mutateAsync).toHaveBeenCalledWith({
      kind: 'drug',
      force: false,
      drug: expect.objectContaining({
        drugName: 'Baby Bottle',
        category: 'product',
        productCategory: 'Baby Care',
        unitOfMeasurement: 'Piece',
        hsnCode: '3924',
        taxPercent: 18,
        price: 150,
        openingStock: 4,
        isReimbursable: false,
      }),
    });
  });
});
