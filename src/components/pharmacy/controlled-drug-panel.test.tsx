import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ControlledDrugPanel,
  controlledLinesOf,
  cartNeedsWitness,
  type ControlledLine,
} from './controlled-drug-panel';

/**
 * This panel replaced a hard refusal. The old counter threw the cashier out
 * with "dispense it via the NDPS workflow"; this tells them what is missing and
 * lets them fix it where they stand. So the tests are about what it demands,
 * and — just as importantly — when it stays out of the way.
 */

const line = (over: Partial<ControlledLine> = {}): ControlledLine => ({
  drugName: 'Paracetamol',
  schedule: 'OTC',
  controlledClass: null,
  vaultControlled: false,
  ...over,
});

const TRAMADOL = line({ drugName: 'Tramadol', schedule: 'H1', controlledClass: 'psychotropic' });
const MORPHINE = line({ drugName: 'Morphine', schedule: 'H1', controlledClass: 'narcotic', vaultControlled: true });

const base = {
  hasRx: false,
  witnessName: null,
  onRequestWitness: vi.fn(),
  enforced: true,
};

describe('controlledLinesOf', () => {
  it('picks out only the lines that carry a control', () => {
    expect(controlledLinesOf([line(), TRAMADOL, MORPHINE])).toHaveLength(2);
  });

  it('counts a Schedule X drug even with no NDPS class', () => {
    expect(controlledLinesOf([line({ schedule: 'X' })])).toHaveLength(1);
  });

  it('leaves plain Schedule H and OTC alone', () => {
    expect(controlledLinesOf([line({ schedule: 'H' }), line({ schedule: 'OTC' })])).toHaveLength(0);
  });
});

describe('cartNeedsWitness', () => {
  it('is true only for a vault narcotic', () => {
    expect(cartNeedsWitness([MORPHINE])).toBe(true);
    // The case that matters: tramadol is controlled but sells over the counter.
    expect(cartNeedsWitness([TRAMADOL])).toBe(false);
    expect(cartNeedsWitness([line()])).toBe(false);
  });

  it('also requires a witness for the legacy isNarcotic flag', () => {
    expect(cartNeedsWitness([line({ drugName: 'Legacy narcotic', isNarcotic: true })])).toBe(true);
  });
});

describe('ControlledDrugPanel', () => {
  it('renders nothing for an ordinary cart', () => {
    const { container } = render(<ControlledDrugPanel {...base} lines={[line()]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names each controlled medicine and what it needs', () => {
    render(<ControlledDrugPanel {...base} lines={[TRAMADOL]} />);
    expect(screen.getByText('Tramadol')).toBeInTheDocument();
    expect(screen.getByText(/Schedule H1/)).toBeInTheDocument();
    expect(screen.getByText(/prescription \+ register entry/i)).toBeInTheDocument();
  });

  it('asks for a prescription when one is missing and enforcement is on', () => {
    render(<ControlledDrugPanel {...base} lines={[TRAMADOL]} />);
    expect(screen.getByText(/A prescription is required/i)).toBeInTheDocument();
  });

  it('confirms the prescription once attached', () => {
    render(<ControlledDrugPanel {...base} lines={[TRAMADOL]} hasRx />);
    expect(screen.getByText(/Prescription attached/i)).toBeInTheDocument();
  });

  it('informs rather than demands while the hospital is still on the old block', () => {
    render(<ControlledDrugPanel {...base} lines={[TRAMADOL]} enforced={false} />);
    expect(screen.queryByText(/A prescription is required/i)).not.toBeInTheDocument();
    expect(screen.getByText(/keeps the register complete/i)).toBeInTheDocument();
  });

  it('asks for a witness only on a vault narcotic', () => {
    const { rerender } = render(<ControlledDrugPanel {...base} lines={[TRAMADOL]} />);
    expect(screen.queryByRole('button', { name: /witness/i })).not.toBeInTheDocument();

    rerender(<ControlledDrugPanel {...base} lines={[MORPHINE]} />);
    expect(screen.getByRole('button', { name: /add witness/i })).toBeInTheDocument();
    // The password is what makes a co-sign real, so the panel says so.
    expect(screen.getByText(/own password/i)).toBeInTheDocument();
  });

  it('confirms once someone has co-signed', () => {
    render(<ControlledDrugPanel {...base} lines={[MORPHINE]} witnessName="Priya N" />);
    expect(screen.getByText(/Witnessed by Priya N/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change witness/i })).toBeInTheDocument();
  });

  it('marks a vault line as safe custody', () => {
    render(<ControlledDrugPanel {...base} lines={[MORPHINE]} />);
    expect(screen.getByText(/safe custody, needs a witness/i)).toBeInTheDocument();
  });
});
