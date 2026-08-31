import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';

/**
 * A doctor types "fever", not "R50.9".
 *
 * Only the narrow box beside this field searched ICD-10, and it searched by
 * CODE — so typing the diagnosis by name left the code empty and the entry
 * went in as free text, with nothing to bill, report or drive the CDSS off.
 */

const results = { current: [] as unknown[] };
const fetching = { current: false };
vi.mock('@/hooks/use-icd', () => ({
  useIcdSearch: () => ({ data: results.current, isFetching: fetching.current }),
}));

import { DiagnosisNameField } from './prescription-pad';

const R509 = { id: '1', code: 'R50.9', title: 'Fever, unspecified', category: 'General symptoms and signs' };
const R50 = { id: '2', code: 'R50', title: 'Fever of other and unknown origin', category: 'General symptoms and signs' };

let formRef: ReturnType<typeof useForm> | null = null;
function Harness() {
  const form = useForm({ defaultValues: { diagnoses: [{ icdCode: '', diagnosisName: '', diagnosisType: 'primary' }] } });
  formRef = form;
  return <DiagnosisNameField form={form} index={0} />;
}
const values = () => (formRef!.getValues() as { diagnoses: { icdCode: string; diagnosisName: string }[] }).diagnoses[0];

beforeEach(() => {
  vi.clearAllMocks();
  results.current = [R509, R50];
  fetching.current = false;
  formRef = null;
});

describe('typing a diagnosis by name', () => {
  it('offers ICD-10 matches with their codes', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByPlaceholderText(/Start typing Diagnosis/i), 'fever');

    await waitFor(() => expect(screen.getByText('R50.9')).toBeInTheDocument());
    expect(screen.getByText('Fever, unspecified')).toBeInTheDocument();
  });

  it('fills BOTH the name and the code when one is picked', async () => {
    // The whole point: the code was staying empty.
    render(<Harness />);
    await userEvent.type(screen.getByPlaceholderText(/Start typing Diagnosis/i), 'fever');
    await waitFor(() => expect(screen.getByText('R50.9')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Fever, unspecified'));

    expect(values()).toMatchObject({ icdCode: 'R50.9', diagnosisName: 'Fever, unspecified' });
  });

  it('keeps free text that matches nothing, rather than forcing a code', async () => {
    // A working diagnosis is often not codeable yet. The form must not insist.
    results.current = [];
    render(<Harness />);
    await userEvent.type(screen.getByPlaceholderText(/Start typing Diagnosis/i), 'query viral illness');

    await waitFor(() => expect(screen.getByText(/saved as free text/i)).toBeInTheDocument());
    expect(values()).toMatchObject({ diagnosisName: 'query viral illness', icdCode: '' });
  });

  it('does not search on a single character', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByPlaceholderText(/Start typing Diagnosis/i), 'f');
    expect(screen.queryByText('R50.9')).not.toBeInTheDocument();
  });

  it('takes the first match on Enter', async () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText(/Start typing Diagnosis/i);
    await userEvent.type(input, 'fever');
    await waitFor(() => expect(screen.getByText('R50.9')).toBeInTheDocument());

    await userEvent.type(input, '{Enter}');

    expect(values()).toMatchObject({ icdCode: 'R50.9' });
  });

  it('never lets Enter submit the prescription', async () => {
    // Enter inside one diagnosis line must not fire the whole form.
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    results.current = [];
    render(
      <form onSubmit={onSubmit}>
        <Harness />
      </form>,
    );
    const input = screen.getByPlaceholderText(/Start typing Diagnosis/i);
    await userEvent.type(input, 'something uncodeable{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(values()).toMatchObject({ diagnosisName: 'something uncodeable' });
  });

  it('closes the list on Escape without changing what was typed', async () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText(/Start typing Diagnosis/i);
    await userEvent.type(input, 'fever');
    await waitFor(() => expect(screen.getByText('R50.9')).toBeInTheDocument());

    await userEvent.type(input, '{Escape}');

    await waitFor(() => expect(screen.queryByText('R50.9')).not.toBeInTheDocument());
    expect(values()).toMatchObject({ diagnosisName: 'fever', icdCode: '' });
  });
});
