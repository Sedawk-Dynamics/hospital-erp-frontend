import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Control the data hook the dialog depends on.
const useFormularyAlternatives = vi.fn();
vi.mock('@/hooks/use-pharmacy', () => ({
  useFormularyAlternatives: (...args: unknown[]) => useFormularyAlternatives(...args),
}));

import { DrugSubstitutesDialog } from './drug-substitutes-dialog';

const DRUG = { id: 'd1', drugName: 'Crocin 650', genericName: 'Paracetamol 650mg' };

const ALT_IN = {
  id: 'a1',
  drugName: 'Dolo 650',
  genericName: 'Paracetamol 650mg',
  dosageForm: 'tablet',
  strength: '650mg',
  manufacturer: 'Micro Labs',
  price: 30,
  packSize: 15,
  looseUnitLabel: 'tablet',
  totalStock: 120,
  inStock: true,
  nearestExpiry: '2027-01-01',
};
const ALT_OUT = {
  ...ALT_IN,
  id: 'a2',
  drugName: 'Calpol 650',
  manufacturer: 'GSK',
  totalStock: 0,
  inStock: false,
};

describe('DrugSubstitutesDialog (G8 — brand/composition alternatives)', () => {
  beforeEach(() => {
    useFormularyAlternatives.mockReset();
  });

  it('does not render content when no drug is selected (closed)', () => {
    useFormularyAlternatives.mockReturnValue({ data: undefined, isLoading: false });
    render(<DrugSubstitutesDialog drug={null} onAdd={vi.fn()} onOpenChange={vi.fn()} />);
    expect(screen.queryByText(/Alternatives for/i)).not.toBeInTheDocument();
  });

  it('shows a loading state while fetching', () => {
    useFormularyAlternatives.mockReturnValue({ data: undefined, isLoading: true });
    render(<DrugSubstitutesDialog drug={DRUG} onAdd={vi.fn()} onOpenChange={vi.fn()} />);
    expect(screen.getByText(/Finding alternatives/i)).toBeInTheDocument();
  });

  it('lists same-composition brands with composition in the header', () => {
    useFormularyAlternatives.mockReturnValue({
      data: { composition: 'Paracetamol 650mg', alternatives: [ALT_IN, ALT_OUT] },
      isLoading: false,
    });
    render(<DrugSubstitutesDialog drug={DRUG} onAdd={vi.fn()} onOpenChange={vi.fn()} />);

    expect(screen.getByText(/Alternatives for/i)).toHaveTextContent('Crocin 650');
    // composition surfaced in the description
    expect(screen.getAllByText(/Paracetamol 650mg/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Dolo 650')).toBeInTheDocument();
    expect(screen.getByText('Calpol 650')).toBeInTheDocument();
    expect(screen.getByText(/In stock: 120/i)).toBeInTheDocument();
    expect(screen.getByText(/Out of stock/i)).toBeInTheDocument();
  });

  it('lets the cashier add an in-stock alternative but disables the out-of-stock one', async () => {
    const onAdd = vi.fn();
    useFormularyAlternatives.mockReturnValue({
      data: { composition: 'Paracetamol 650mg', alternatives: [ALT_IN, ALT_OUT] },
      isLoading: false,
    });
    render(<DrugSubstitutesDialog drug={DRUG} onAdd={onAdd} onOpenChange={vi.fn()} />);

    const addButtons = screen.getAllByRole('button', { name: /add/i });
    // First row = in-stock (enabled), second = out-of-stock (disabled).
    expect(addButtons[0]).toBeEnabled();
    expect(addButtons[1]).toBeDisabled();

    await userEvent.click(addButtons[0]);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1', drugName: 'Dolo 650' }));
  });

  it('shows an empty state when no brand shares the composition', () => {
    useFormularyAlternatives.mockReturnValue({
      data: { composition: 'Paracetamol 650mg', alternatives: [] },
      isLoading: false,
    });
    render(<DrugSubstitutesDialog drug={DRUG} onAdd={vi.fn()} onOpenChange={vi.fn()} />);
    expect(screen.getByText(/No alternatives/i)).toBeInTheDocument();
  });
});
