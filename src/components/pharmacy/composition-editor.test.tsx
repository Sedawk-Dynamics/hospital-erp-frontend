import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Suggestions come from the server. Spread the real module so this mock cannot
// leak into other files in the worker — a bare vi.mock here broke unrelated
// tests once already.
const suggestions = vi.fn();
vi.mock('@/hooks/use-drug-master', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useSaltSearch: (...a: unknown[]) => suggestions(...a),
}));

import { useState } from 'react';
import {
  CompositionEditor, parseCompositionText, compositionPreview, emptySaltRow,
  type SaltRowInput,
} from './composition-editor';

function renderEditor(props: Parameters<typeof CompositionEditor>[0]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CompositionEditor {...props} />
    </QueryClientProvider>,
  );
}

/**
 * A stateful harness. The editor is a controlled component, so a test that
 * only captures onChange never feeds the new value back — typing then leaves
 * just the last keystroke, which looks like a component bug and is not one.
 */
function StatefulEditor({ onRows }: { onRows: (r: SaltRowInput[]) => void }) {
  const [rows, setRows] = useState<SaltRowInput[]>([emptySaltRow()]);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <CompositionEditor
        rows={rows}
        onChange={(r) => { setRows(r); onRows(r); }}
      />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  suggestions.mockReturnValue({ data: [] });
});

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
    renderEditor({ rows: [emptySaltRow()], onChange: () => {} });
    expect(screen.getByLabelText('Molecule 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Strength 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit 1')).toBeInTheDocument();
  });

  it('adds a molecule', async () => {
    let rows = [emptySaltRow()];
    const { rerender } = renderEditor({ rows, onChange: (r) => { rows = r; } });
    await userEvent.click(screen.getByRole('button', { name: /Add molecule/i }));
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <CompositionEditor rows={rows} onChange={(r) => { rows = r; }} />
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText('Molecule 2')).toBeInTheDocument();
  });

  it('will not let the last molecule be removed', () => {
    // An empty composition editor with no rows has nothing to type into.
    renderEditor({ rows: [emptySaltRow()], onChange: () => {} });
    expect(screen.getByRole('button', { name: /Remove molecule 1/i })).toBeDisabled();
  });

  it('rejects letters in the strength box', async () => {
    let latest: SaltRowInput[] = [];
    render(<StatefulEditor onRows={(r) => { latest = r; }} />);
    await userEvent.type(screen.getByLabelText('Strength 1'), '5a0');
    expect(latest[0].strengthValue).toBe('50');
  });
});

describe('the molecule box', () => {
  const PARA = {
    id: 's1', name: 'Paracetamol', norm: 'paracetamol',
    scheduleCode: 'OTC', controlledClass: null, vaultControlled: false,
  };
  const TRAM = {
    id: 's2', name: 'Tramadol', norm: 'tramadol',
    scheduleCode: 'H1', controlledClass: 'psychotropic', vaultControlled: false,
  };

  it('offers what the system already knows, with the schedule shown', async () => {
    suggestions.mockReturnValue({ data: [PARA, TRAM] });
    renderEditor({ rows: [emptySaltRow()], onChange: () => {} });
    await userEvent.click(screen.getByLabelText('Molecule 1'));

    expect(await screen.findByRole('listbox', { name: /Molecule 1 suggestions/i })).toBeInTheDocument();
    expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    // The schedule is the thing being chosen, so it has to be visible.
    expect(screen.getByText('H1')).toBeInTheDocument();
  });

  it('fills the box when a suggestion is picked', async () => {
    suggestions.mockReturnValue({ data: [TRAM] });
    let rows = [emptySaltRow()];
    renderEditor({ rows, onChange: (r) => { rows = r; } });
    await userEvent.click(screen.getByLabelText('Molecule 1'));
    await userEvent.click(await screen.findByText('Tramadol'));
    expect(rows[0].name).toBe('Tramadol');
  });

  it('flags a molecule nobody has scheduled yet', async () => {
    suggestions.mockReturnValue({
      data: [{ ...PARA, id: 's9', name: 'Qwertyzine', scheduleCode: null }],
    });
    renderEditor({ rows: [emptySaltRow()], onChange: () => {} });
    await userEvent.click(screen.getByLabelText('Molecule 1'));
    expect(await screen.findByText('undecided')).toBeInTheDocument();
  });

  it('still accepts a molecule that is not on the list', async () => {
    // A genuinely new molecule is what the review queue exists to catch, so the
    // box must suggest rather than restrict.
    suggestions.mockReturnValue({ data: [] });
    let latest: SaltRowInput[] = [];
    render(<StatefulEditor onRows={(r) => { latest = r; }} />);
    await userEvent.type(screen.getByLabelText('Molecule 1'), 'Zyxomorphine');
    expect(latest[0].name).toBe('Zyxomorphine');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
