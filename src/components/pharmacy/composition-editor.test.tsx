import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CompositionEditor, parseCompositionText, compositionPreview, emptySaltRow,
} from './composition-editor';

/**
 * The editor replaces a single text box, so the property that matters is that
 * nothing is lost on the way in — a molecule with an unreadable strength must
 * still become a row a person can see and fix, never a silent omission.
 */

describe('parseCompositionText', () => {
  it('splits a pasted composition into molecule, quantity and unit', () => {
    expect(parseCompositionText('Paracetamol (500mg) + Caffeine (65mg)')).toEqual([
      { name: 'Paracetamol', strengthValue: '500', strengthUnit: 'mg' },
      { name: 'Caffeine', strengthValue: '65', strengthUnit: 'mg' },
    ]);
  });

  it('keeps a molecule whose strength cannot be read', () => {
    // Dropping it would repeat the exact bug this editor exists to stop.
    const rows = parseCompositionText('Paracetamol (500mg) + Zyxomorphine (NA)');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ name: 'Zyxomorphine', strengthValue: '' });
  });

  it('reads the other units', () => {
    expect(parseCompositionText('Fentanyl (50mcg)')[0]).toMatchObject({ strengthValue: '50', strengthUnit: 'mcg' });
    expect(parseCompositionText('Insulin (40iu)')[0]).toMatchObject({ strengthUnit: 'iu' });
  });

  it('survives an empty or junk paste', () => {
    expect(parseCompositionText('')).toEqual([]);
    expect(parseCompositionText('   +  + ')).toEqual([]);
  });
});

describe('compositionPreview', () => {
  it('renders what will actually be stored', () => {
    expect(compositionPreview([
      { name: 'Paracetamol', strengthValue: '500', strengthUnit: 'mg' },
      { name: 'Caffeine', strengthValue: '65', strengthUnit: 'mg' },
    ])).toBe('Paracetamol (500mg) + Caffeine (65mg)');
  });

  it('omits a strength that was not entered rather than inventing one', () => {
    expect(compositionPreview([{ name: 'Paracetamol', strengthValue: '', strengthUnit: 'mg' }]))
      .toBe('Paracetamol');
  });

  it('round-trips: preview then parse gives the same rows back', () => {
    const rows = [
      { name: 'Ibuprofen', strengthValue: '400', strengthUnit: 'mg' },
      { name: 'Paracetamol', strengthValue: '325', strengthUnit: 'mg' },
    ];
    expect(parseCompositionText(compositionPreview(rows))).toEqual(rows);
  });
});

describe('CompositionEditor', () => {
  it('offers three fields per molecule, not one box', () => {
    render(<CompositionEditor rows={[emptySaltRow()]} onChange={() => {}} />);
    expect(screen.getByLabelText('Molecule 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Strength 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit 1')).toBeInTheDocument();
  });

  it('adds a molecule', async () => {
    let rows = [emptySaltRow()];
    const { rerender } = render(
      <CompositionEditor rows={rows} onChange={(r) => { rows = r; }} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Add molecule/i }));
    rerender(<CompositionEditor rows={rows} onChange={(r) => { rows = r; }} />);
    expect(screen.getByLabelText('Molecule 2')).toBeInTheDocument();
  });

  it('will not let the last molecule be removed', () => {
    // An empty composition editor with no rows has nothing to type into.
    render(<CompositionEditor rows={[emptySaltRow()]} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Remove molecule 1/i })).toBeDisabled();
  });

  it('rejects letters in the strength box', async () => {
    let rows = [emptySaltRow()];
    render(<CompositionEditor rows={rows} onChange={(r) => { rows = r; }} />);
    await userEvent.type(screen.getByLabelText('Strength 1'), '5a0');
    expect(rows[0].strengthValue).not.toMatch(/[a-z]/i);
  });
});
