import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * A patient's own list of long-term conditions.
 *
 * It was a free-text box, so one person's "sugar" was another's "diabetes" and
 * a third's "DM", and nothing downstream could count or match them. The ICD-10
 * catalogue now sits in front of it — but the free text stays, because plenty
 * of real conditions are not in ICD and a picker that refused them would push
 * people to write the condition somewhere it does not belong.
 */

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(async () => ({ data: {} })),
  apiPut: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

const icdResults = { current: [] as unknown[] };
vi.mock('@/hooks/use-icd', () => ({
  useIcdSearch: () => ({ data: icdResults.current, isFetching: false }),
}));

import { DisordersField } from './page';

const ASTHMA = { id: '1', code: 'J45.9', title: 'Asthma, unspecified', category: 'Chronic lower respiratory diseases', isBillable: true, isCustom: false, tenantId: null };
const DM = { id: '2', code: 'E11.9', title: 'Type 2 diabetes mellitus, without complications', category: 'Diabetes mellitus', isBillable: true, isCustom: false, tenantId: null };

beforeEach(() => {
  vi.clearAllMocks();
  icdResults.current = [ASTHMA, DM];
});

/** Opens the picker and clicks a condition by its title. */
async function pick(title: string) {
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.type(screen.getByPlaceholderText(/Type a code or condition/i), 'a');
  await waitFor(() => expect(screen.getByText(title)).toBeInTheDocument());
  await userEvent.click(screen.getByText(title));
}

describe('the patient’s existing-disorder list', () => {
  it('adds a picked condition as "CODE — Title"', async () => {
    // Byte-identical to the clinician panel on purpose: medical history is one
    // record per person and both sides write this same field.
    const onChange = vi.fn();
    render(<DisordersField value="" onChange={onChange} />);

    await pick('Asthma, unspecified');

    expect(onChange).toHaveBeenCalledWith('J45.9 — Asthma, unspecified');
  });

  it('appends to what is already there rather than replacing it', async () => {
    const onChange = vi.fn();
    render(<DisordersField value="Migraine since 2019" onChange={onChange} />);

    await pick('Asthma, unspecified');

    expect(onChange).toHaveBeenCalledWith('Migraine since 2019\nJ45.9 — Asthma, unspecified');
  });

  it('will not add the same condition twice', async () => {
    // Clicking around the list must not leave a column of repeats.
    const onChange = vi.fn();
    render(<DisordersField value="J45.9 — Asthma, unspecified" onChange={onChange} />);

    await pick('Asthma, unspecified');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('still takes free text, for conditions the list does not have', async () => {
    const onChange = vi.fn();
    render(<DisordersField value="" onChange={onChange} />);

    await userEvent.type(screen.getByRole('textbox'), 'x');

    expect(onChange).toHaveBeenCalledWith('x');
  });

  it('says the list is optional, so nobody thinks a condition is unrecordable', async () => {
    render(<DisordersField value="" onChange={vi.fn()} />);
    expect(screen.getByText(/anything not on the list still belongs here/i)).toBeInTheDocument();
  });
});
