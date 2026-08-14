import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScheduleBadge, ControlledBadge } from './schedule-badge';

/**
 * The two chips carry a legal claim about a medicine, so what they say — and
 * what they DON'T say — matters. In particular a Schedule H1 psychotropic like
 * tramadol must read as "needs a prescription and a register line", never as
 * "keep it in the safe".
 */

describe('ScheduleBadge', () => {
  it('labels each schedule', () => {
    const { rerender } = render(<ScheduleBadge schedule="X" />);
    expect(screen.getByText('Schedule X')).toBeInTheDocument();
    rerender(<ScheduleBadge schedule="H1" />);
    expect(screen.getByText('Schedule H1')).toBeInTheDocument();
    rerender(<ScheduleBadge schedule="H" />);
    expect(screen.getByText('Schedule H')).toBeInTheDocument();
    rerender(<ScheduleBadge schedule="G" />);
    expect(screen.getByText('Schedule G')).toBeInTheDocument();
    rerender(<ScheduleBadge schedule="H2" />);
    expect(screen.getByText('Schedule H2')).toBeInTheDocument();
  });

  it('stays out of the way for unscheduled and unclassified drugs', () => {
    const { container, rerender } = render(<ScheduleBadge schedule="OTC" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ScheduleBadge schedule={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ScheduleBadge schedule={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows OTC only when the caller asks', () => {
    render(<ScheduleBadge schedule="OTC" showOtc />);
    expect(screen.getByText('OTC')).toBeInTheDocument();
  });

  it('explains the schedule, and which salt caused it, in the tooltip', () => {
    render(<ScheduleBadge schedule="H1" reason="Schedule H1 — matched Tramadol." />);
    const title = screen.getByText('Schedule H1').closest('[title]')?.getAttribute('title') ?? '';
    expect(title).toMatch(/register/i);
    expect(title).toMatch(/matched Tramadol/);
  });

  it('says so when a pharmacy admin set the schedule by hand', () => {
    render(<ScheduleBadge schedule="X" source="manual" />);
    const title = screen.getByText('Schedule X').closest('[title]')?.getAttribute('title') ?? '';
    expect(title).toMatch(/Set manually/i);
  });

  it('describes Schedule G as a caution label, not a prescription drug', () => {
    render(<ScheduleBadge schedule="G" />);
    const title = screen.getByText('Schedule G').closest('[title]')?.getAttribute('title') ?? '';
    expect(title).toMatch(/not a prescription drug/i);
  });
});

describe('ControlledBadge', () => {
  it('shows nothing for an ordinary drug', () => {
    const { container } = render(<ControlledBadge controlledClass={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks a vaulted narcotic as safe-custody', () => {
    render(<ControlledBadge controlledClass="narcotic" vaultControlled />);
    expect(screen.getByText(/Narcotic/)).toBeInTheDocument();
    const title = screen.getByText(/Narcotic/).closest('[title]')?.getAttribute('title') ?? '';
    expect(title).toMatch(/safe/i);
    expect(title).toMatch(/witness/i);
  });

  it('does NOT imply safe custody for a counter-dispensed psychotropic', () => {
    // Tramadol's case: register-tracked, but sold over the counter under H1.
    render(<ControlledBadge controlledClass="psychotropic" vaultControlled={false} />);
    const chip = screen.getByText(/Psychotropic/);
    expect(chip.textContent).not.toMatch(/Vault/);
    const title = chip.closest('[title]')?.getAttribute('title') ?? '';
    expect(title).toMatch(/dispensed normally/i);
    expect(title).not.toMatch(/witness/i);
  });
});
