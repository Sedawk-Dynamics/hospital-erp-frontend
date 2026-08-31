import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * "Existing disorders" — one search bar and a chip per condition.
 *
 * It was free text, so the same condition arrived as "sugar", "diabetes" and
 * "DM" and nothing downstream could count or match them. The chips are still
 * that same text column, one line each: no migration, and the patient file, the
 * safety banner and the doctor's file view all keep reading it untouched.
 *
 * No ICD codes are shown or stored — it is a list of conditions. Lines the
 * clinician panel wrote in the older "CODE — Name" format are still understood,
 * which is what the backwards-compatibility cases below are about.
 */

const results = { current: [] as unknown[] };
const fetching = { current: false };
vi.mock('@/hooks/use-disorders', () => ({
  useDisorderSearch: () => ({ data: results.current, isFetching: fetching.current }),
}));

import { DisorderPicker, parseDisorders } from './disorder-picker';

const ASTHMA = { id: '1', name: 'Asthma, unspecified', icdCode: 'J45.9', category: 'Chronic lower respiratory diseases', isCustom: false };
const DM = { id: '2', name: 'Type 2 diabetes mellitus, without complications', icdCode: 'E11.9', category: 'Diabetes mellitus', isCustom: false };

beforeEach(() => {
  vi.clearAllMocks();
  results.current = [ASTHMA, DM];
  fetching.current = false;
});

const search = () => screen.getByPlaceholderText(/Search conditions/i);

async function pick(name: string) {
  await userEvent.type(search(), 'asth');
  await waitFor(() => expect(screen.getByText(name)).toBeInTheDocument());
  await userEvent.click(screen.getByText(name));
}

describe('reading what is already stored', () => {
  it('shows a line written in the older "CODE — Name" format by its name', () => {
    // The clinician panel wrote that format before this control existed, so it
    // is still on record and must read as the condition, not as a code.
    expect(parseDisorders('J45.9 — Asthma, unspecified')).toEqual([
      { label: 'Asthma, unspecified', raw: 'J45.9 — Asthma, unspecified' },
    ]);
  });

  it('keeps free text written before the picker existed', () => {
    // Years of typed history live in this column. It must not be thrown away
    // just because it does not look like a code.
    expect(parseDisorders('sugar since 2019')).toEqual([
      { label: 'sugar since 2019', raw: 'sugar since 2019' },
    ]);
  });

  it('shows every stored line as its own chip', () => {
    render(<DisorderPicker value={'J45.9 — Asthma, unspecified\nsugar since 2019'} onChange={vi.fn()} />);
    // The list is conditions, not classification. A code means nothing to
    // either the patient or the clinician reading it.
    expect(screen.queryByText('J45.9')).not.toBeInTheDocument();
    expect(screen.getByText('Asthma, unspecified')).toBeInTheDocument();
    expect(screen.getByText('sugar since 2019')).toBeInTheDocument();
  });
});

describe('adding a disorder', () => {
  it('stores the condition by name, with no code', async () => {
    const onChange = vi.fn();
    render(<DisorderPicker value="" onChange={onChange} />);
    await pick('Asthma, unspecified');
    expect(onChange).toHaveBeenCalledWith('Asthma, unspecified');
  });

  it('appends rather than replacing what is there', async () => {
    const onChange = vi.fn();
    render(<DisorderPicker value="sugar since 2019" onChange={onChange} />);
    await pick('Asthma, unspecified');
    expect(onChange).toHaveBeenCalledWith('sugar since 2019\nAsthma, unspecified');
  });

  it('marks one already on the list instead of hiding it', async () => {
    // Hiding it reads as a broken search; saying "added" answers the question.
    render(<DisorderPicker value="J45.9 — Asthma, unspecified" onChange={vi.fn()} />);
    await userEvent.type(search(), 'asth');
    await waitFor(() => expect(screen.getByText('added')).toBeInTheDocument());
  });

  it('will not add the same disorder twice, even in the older format', async () => {
    // Stored as "J45.9 — Asthma, unspecified" by the clinician panel before
    // this control existed. Picking it again must recognise it, not duplicate.
    const onChange = vi.fn();
    render(<DisorderPicker value="J45.9 — Asthma, unspecified" onChange={onChange} />);
    await pick('Asthma, unspecified');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('adds the first match on Enter, and never submits the form', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const onChange = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <DisorderPicker value="" onChange={onChange} />
      </form>,
    );
    await userEvent.type(search(), 'asth');
    await waitFor(() => expect(screen.getByText('Asthma, unspecified')).toBeInTheDocument());
    await userEvent.type(search(), '{Enter}');

    expect(onChange).toHaveBeenCalledWith('Asthma, unspecified');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('says so when nothing matches, and where to get it added', async () => {
    results.current = [];
    render(<DisorderPicker value="" onChange={vi.fn()} />);
    await userEvent.type(search(), 'zzzz');
    await waitFor(() => expect(screen.getByText(/No condition matching/i)).toBeInTheDocument());
  });
});

describe('removing a disorder', () => {
  it('takes out only that line', async () => {
    const onChange = vi.fn();
    render(
      <DisorderPicker
        value={'Asthma, unspecified\nType 2 diabetes mellitus, without complications'}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByLabelText('Remove Asthma, unspecified'));
    expect(onChange).toHaveBeenCalledWith('Type 2 diabetes mellitus, without complications');
  });

  it('can remove free text too, so old entries are not stuck', async () => {
    const onChange = vi.fn();
    render(<DisorderPicker value={'sugar since 2019\nJ45.9 — Asthma, unspecified'} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Remove sugar since 2019'));
    expect(onChange).toHaveBeenCalledWith('J45.9 — Asthma, unspecified');
  });
});
