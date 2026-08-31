import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';

/**
 * A doctor types "fever", not "R50.9".
 *
 * Neither the prescription pad nor the examination step searched ICD-10 by
 * NAME — one had a code picker beside the field, the other a bare text box —
 * so typing the diagnosis left the code empty and the entry went in as free
 * text, with nothing to bill from, report on or drive the CDSS off.
 */

const results = { current: [] as unknown[] };
const fetching = { current: false };
vi.mock('@/hooks/use-icd', () => ({
  useIcdSearch: () => ({ data: results.current, isFetching: fetching.current }),
}));

import { DiagnosisNameField } from './diagnosis-name-field';

const R509 = { id: '1', code: 'R50.9', title: 'Fever, unspecified', category: 'General symptoms and signs' };
const R50 = { id: '2', code: 'R50', title: 'Fever of other and unknown origin', category: 'General symptoms and signs' };

// The component takes `form: any` (the whole pad does), so the harness holds
// it loosely too rather than fighting RHF's generics in a test.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let formRef: any = null;
function Harness() {
  const form = useForm({ defaultValues: { diagnoses: [{ icdCode: '', diagnosisName: '', diagnosisType: 'primary' }] } });
  formRef = form;
  return <DiagnosisNameField form={form} index={0} />;
}
const values = () =>
  (formRef.getValues() as { diagnoses: { icdCode: string; diagnosisName: string }[] }).diagnoses[0];

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

  describe('escaping the cards it sits in', () => {
    // Both hosts clip an in-flow dropdown, in two different ways no z-index can
    // escape: the prescription pad's card and the consultation card both use
    // `overflow-hidden`, and the consultation DIALOG scrolls its body with
    // `overflow-y-auto`. Measured against the real markup before this: the
    // second suggestion was cut in half and the third never appeared.
    it('renders the list outside the clipping container, on the body', async () => {
      const { container } = render(
        <div className="overflow-hidden" data-testid="clipper">
          <Harness />
        </div>,
      );
      await userEvent.type(screen.getByPlaceholderText(/Start typing Diagnosis/i), 'fever');
      await waitFor(() => expect(screen.getByText('R50.9')).toBeInTheDocument());

      // Found by a screen query (which searches the whole document) but NOT
      // inside the container that would clip it.
      expect(container.querySelector('[data-testid="clipper"]')).not.toContainElement(
        screen.getByText('R50.9'),
      );
      expect(document.body).toContainElement(screen.getByText('R50.9'));
    });

    it('pins the list to the input it belongs to', async () => {
      // jsdom reports zeroes, so the rect is stubbed — what is asserted is that
      // the measured position is USED, not the numbers themselves.
      const rect = { bottom: 220, left: 64, width: 320, top: 190, right: 384, height: 30, x: 64, y: 190, toJSON: () => ({}) };
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);
      render(<Harness />);
      await userEvent.type(screen.getByPlaceholderText(/Start typing Diagnosis/i), 'fever');
      await waitFor(() => expect(screen.getByText('R50.9')).toBeInTheDocument());

      const list = screen.getByText('R50.9').closest('div.fixed') as HTMLElement;
      expect(list).toBeTruthy();
      expect(list.style.left).toBe('64px');
      expect(list.style.width).toBe('320px');
      expect(list.style.top).toBe('224px'); // just under the input
      vi.restoreAllMocks();
    });
  });
});
