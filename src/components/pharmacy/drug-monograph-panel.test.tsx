import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const useDrugMonograph = vi.fn();
vi.mock('@/hooks/use-drug-master', () => ({
  useDrugMonograph: (...args: unknown[]) => useDrugMonograph(...args),
}));

import { DrugMonographPanel } from './drug-monograph-panel';

// The shape GET /drug-master/:id/monograph returns — the product's name is
// already put back into the texts, and every section is structured data.
const DOLO = {
  id: 'm1',
  name: 'Dolo 650 Tablet',
  kind: 'drug',
  sourceId: 'DRS012345',
  sourceRelease: '2026-06',
  genericName: 'Paracetamol (650mg)',
  saltComposition: 'Paracetamol (650mg)',
  manufacturer: 'Micro Labs Ltd',
  productForm: 'Tablet',
  packageType: 'Strip',
  packQuantity: '15',
  packSizeLabel: 'strip of 15 tablets',
  mrp: '33.60',
  rxRequired: false,
  habitForming: false,
  therapeuticClass: 'PAIN ANALGESICS',
  chemicalClass: 'Anilide',
  actionClass: null,
  productCategory: null,
  categoryPath: null,
  storage: 'Store below 30°C',
  countryOfOrigin: 'India',
  description: 'Pain relief; Treatment of Fever',
  sideEffects: 'Nausea; Vomiting',
  safetyAdvice: { alcohol: 'unsafe', pregnancy: 'safe_if_prescribed', driving: 'safe' },
  scheduleResolved: 'OTC',
  isDiscontinued: false,
  sections: [
    { key: 'intro', title: 'About', block: { type: 'paragraphs', paragraphs: ['Dolo 650 Tablet helps relieve pain and fever.'] } },
    {
      key: 'safetyAdvice',
      title: 'Safety advice',
      block: {
        type: 'verdicts',
        items: [{ topic: 'Alcohol', verdict: 'UNSAFE', text: 'Avoid alcohol with Dolo 650 Tablet.' }],
      },
    },
    {
      key: 'interactions',
      title: 'Drug interactions',
      block: {
        type: 'interactions',
        items: Array.from({ length: 14 }, (_, i) => ({
          drug: `Drug ${i + 1}`,
          route: 'Oral Route',
          severity: i === 0 ? 'Life-threatening' : 'Moderate',
          advice: `Advice ${i + 1}`,
        })),
      },
    },
    {
      key: 'faq',
      title: 'Questions and answers',
      block: { type: 'faq', items: [{ question: 'Is Dolo 650 Tablet safe?', answer: 'Yes, when taken as advised.' }] },
    },
    { key: 'marketer', title: 'Marketer', block: { type: 'list', items: ['Micro Labs Ltd', 'Bengaluru'] } },
  ],
};

describe('DrugMonographPanel', () => {
  beforeEach(() => useDrugMonograph.mockReset());

  it('shows a spinner, not an empty panel, while the monograph loads', () => {
    useDrugMonograph.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = render(<DrugMonographPanel drugId="m1" />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('says so when the monograph cannot be loaded', () => {
    useDrugMonograph.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<DrugMonographPanel drugId="m1" />);
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
  });

  it('lists the label facts, and states the prescription line either way', () => {
    useDrugMonograph.mockReturnValue({ data: DOLO, isLoading: false, isError: false });
    render(<DrugMonographPanel drugId="m1" />);
    expect(screen.getByText('Paracetamol (650mg)')).toBeInTheDocument();
    expect(screen.getByText('PAIN ANALGESICS')).toBeInTheDocument();
    expect(screen.getByText('No prescription needed')).toBeInTheDocument();
    expect(screen.getByText('DRS012345 · release 2026-06')).toBeInTheDocument();
    // An absent fact is not rendered as an empty row.
    expect(screen.queryByText('Action class')).not.toBeInTheDocument();
  });

  it('shows the safety verdicts as labelled chips', () => {
    useDrugMonograph.mockReturnValue({ data: DOLO, isLoading: false, isError: false });
    render(<DrugMonographPanel drugId="m1" />);
    expect(screen.getByText('Safe if prescribed')).toBeInTheDocument();
    // Alcohol appears as a chip and again in the safety-advice section.
    expect(screen.getAllByText('Unsafe').length).toBeGreaterThanOrEqual(2);
  });

  it('renders every section from its structured block', () => {
    useDrugMonograph.mockReturnValue({ data: DOLO, isLoading: false, isError: false });
    const { container } = render(<DrugMonographPanel drugId="m1" />);
    // Section headings are the <summary> of each collapsible — "Marketer" is
    // also a fact label, so the headings are read from there, in order.
    const headings = [...container.querySelectorAll('summary')].map((s) => s.textContent);
    expect(headings).toEqual(['About', 'Safety advice', 'Drug interactions', 'Questions and answers', 'Marketer']);
    expect(screen.getByText('Dolo 650 Tablet helps relieve pain and fever.')).toBeInTheDocument();
    expect(screen.getByText('Is Dolo 650 Tablet safe?')).toBeInTheDocument();
    expect(screen.getByText('Bengaluru')).toBeInTheDocument();
  });

  it('shows the first twelve interactions and offers the rest', () => {
    useDrugMonograph.mockReturnValue({ data: DOLO, isLoading: false, isError: false });
    render(<DrugMonographPanel drugId="m1" />);
    expect(screen.getByText('Drug 12')).toBeInTheDocument();
    expect(screen.queryByText('Drug 13')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show all 14' }));
    expect(screen.getByText('Drug 14')).toBeInTheDocument();
    expect(screen.getByText('Life-threatening')).toBeInTheDocument();
  });

  it('labels an OTC product as over the counter', () => {
    useDrugMonograph.mockReturnValue({
      data: { ...DOLO, kind: 'otc', rxRequired: false, categoryPath: 'Diabetes > Diabetic Diet', sections: [] },
      isLoading: false,
      isError: false,
    });
    render(<DrugMonographPanel drugId="m1" />);
    expect(screen.getByText('Over the counter')).toBeInTheDocument();
    expect(screen.getByText('Diabetes > Diabetic Diet')).toBeInTheDocument();
  });
});
