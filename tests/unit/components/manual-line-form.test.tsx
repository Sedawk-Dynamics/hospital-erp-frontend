import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { ManualLineForm } from '@/components/hospital/billing/bill-generator-dialog';

describe('ManualLineForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with a valid quantity and adds the charge', async () => {
    const onAdd = vi.fn().mockResolvedValue(true);
    render(<ManualLineForm onAdd={onAdd} loading={false} />);

    expect(screen.getByPlaceholderText('Qty')).toHaveValue(1);
    fireEvent.change(screen.getByPlaceholderText('Description (e.g. Dressing fee)'), {
      target: { value: 'Dressing fee' },
    });
    fireEvent.change(screen.getByPlaceholderText('Unit ₹'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith({
        description: 'Dressing fee',
        quantity: 1,
        unitPrice: 250,
        discount: 0,
      }),
    );
    expect(screen.getByPlaceholderText('Description (e.g. Dressing fee)')).toHaveValue('');
    expect(screen.getByPlaceholderText('Qty')).toHaveValue(1);
    expect(screen.getByPlaceholderText('Unit ₹')).toHaveValue(null);
  });

  it('rejects a zero quantity before calling the API', async () => {
    const onAdd = vi.fn().mockResolvedValue(true);
    render(<ManualLineForm onAdd={onAdd} loading={false} />);

    fireEvent.change(screen.getByPlaceholderText('Description (e.g. Dressing fee)'), {
      target: { value: 'Dressing fee' },
    });
    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '0' } });
    fireEvent.change(screen.getByPlaceholderText('Unit ₹'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAdd).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Quantity must be a positive whole number');
  });

  it('keeps the entered charge when the API refuses it', async () => {
    const onAdd = vi.fn().mockResolvedValue(false);
    render(<ManualLineForm onAdd={onAdd} loading={false} />);

    fireEvent.change(screen.getByPlaceholderText('Description (e.g. Dressing fee)'), {
      target: { value: 'Special dressing' },
    });
    fireEvent.change(screen.getByPlaceholderText('Unit ₹'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledOnce());
    expect(screen.getByPlaceholderText('Description (e.g. Dressing fee)')).toHaveValue('Special dressing');
    expect(screen.getByPlaceholderText('Unit ₹')).toHaveValue(300);
  });

  it('disables adding until the bill is editable', () => {
    render(
      <ManualLineForm
        onAdd={vi.fn()}
        loading={false}
        disabled
        disabledReason="Reopen this bill before adding another charge."
      />,
    );

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByText('Reopen this bill before adding another charge.')).toBeInTheDocument();
  });
});
