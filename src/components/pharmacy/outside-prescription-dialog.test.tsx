import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const ocrMutate = vi.fn();
const createMutate = vi.fn();
vi.mock('@/hooks/use-pharmacy', () => ({
  useOcrPrescription: () => ({ mutateAsync: ocrMutate, isPending: false }),
  useCreateExternalPrescription: () => ({ mutateAsync: createMutate, isPending: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { OutsidePrescriptionDialog } from './outside-prescription-dialog';

/**
 * The dialog is what stands between a walk-in with a paper prescription and a
 * counter that will soon refuse to sell Schedule H/H1/X without one. Its job is
 * to capture a prescriber the register can be keyed on — so the tests are about
 * that, not about layout.
 */

const setup = (props: Partial<React.ComponentProps<typeof OutsidePrescriptionDialog>> = {}) =>
  render(
    <OutsidePrescriptionDialog
      open
      onOpenChange={vi.fn()}
      onCaptured={vi.fn()}
      {...props}
    />,
  );

beforeEach(() => {
  ocrMutate.mockReset();
  createMutate.mockReset();
});

describe('OutsidePrescriptionDialog', () => {
  it('will not save without a prescriber — the record is worthless otherwise', async () => {
    setup();
    const save = screen.getByRole('button', { name: /attach to sale/i });
    expect(save).toBeDisabled();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('enables saving once a prescriber is named', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText(/prescriber name/i), 'A. Gaur');
    expect(screen.getByRole('button', { name: /attach to sale/i })).toBeEnabled();
  });

  it('asks for the patient address, which the H1 register needs', () => {
    setup();
    const address = screen.getByLabelText(/patient address/i);
    expect(address).toBeInTheDocument();
    expect(address).toHaveAttribute('placeholder', expect.stringMatching(/H1 register/i));
  });

  it('hands the saved prescription back to the caller', async () => {
    const user = userEvent.setup();
    const onCaptured = vi.fn();
    const onOpenChange = vi.fn();
    createMutate.mockResolvedValue({ id: 'ext-1', prescriberName: 'A. Gaur' });

    setup({ onCaptured, onOpenChange });
    await user.type(screen.getByLabelText(/prescriber name/i), 'A. Gaur');
    await user.type(screen.getByLabelText(/registration no/i), 'NMC-9875');
    await user.click(screen.getByRole('button', { name: /attach to sale/i }));

    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ prescriberName: 'A. Gaur', prescriberRegNo: 'NMC-9875' }),
    );
    expect(onCaptured).toHaveBeenCalledWith({ id: 'ext-1', prescriberName: 'A. Gaur' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('sends a walk-in with no patient id at all', async () => {
    const user = userEvent.setup();
    createMutate.mockResolvedValue({ id: 'ext-2' });
    setup({ patientId: null });

    await user.type(screen.getByLabelText(/prescriber name/i), 'Dr Rao');
    await user.type(screen.getByLabelText(/patient name/i), 'Ramesh');
    await user.click(screen.getByRole('button', { name: /attach to sale/i }));

    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: null, patientNameRaw: 'Ramesh' }),
    );
  });

  it('offers both a camera and a file path — counters use either', () => {
    setup();
    expect(screen.getByRole('button', { name: /photograph/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
  });
});
