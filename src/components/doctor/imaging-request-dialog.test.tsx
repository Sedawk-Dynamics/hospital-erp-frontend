import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ImagingRequestDialog } from './imaging-request-dialog';

// The doctor orders imaging as well as lab, and the study picker had the same
// defects the lab one did: it rendered results ONLY while something was typed,
// so there was no way to see what the hospital offers without already knowing a
// study's name — and a hospital with no radiology tariffs configured looked
// exactly like a broken search.

const useImagingCatalog = vi.fn();
vi.mock('@/hooks/use-imaging-catalog', () => ({
  useImagingCatalog: (...a: unknown[]) => useImagingCatalog(...a),
}));
vi.mock('@/hooks/use-doctor', () => ({
  useCreateImagingRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePatientDiagnoses: () => ({ data: [] }),
}));
vi.mock('@/hooks/use-cdss', () => ({ useOrderSuggestions: () => ({ data: undefined }) }));

const CATALOG = [
  { id: '1', serviceName: 'Chest X-Ray PA', serviceCode: 'CXR', basePrice: 300, gstRatePercent: 0, modality: 'xray', isActive: true },
  { id: '2', serviceName: 'USG Abdomen', serviceCode: 'USGA', basePrice: 900, gstRatePercent: 0, modality: 'ultrasound', isActive: true },
  { id: '3', serviceName: 'CT Brain Plain', serviceCode: 'CTB', basePrice: 2500, gstRatePercent: 0, modality: 'ct', isActive: true },
];

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ImagingRequestDialog open onOpenChange={vi.fn()} patientId="pat-1" visitId="visit-1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useImagingCatalog.mockReturnValue({ data: CATALOG, isLoading: false });
});

describe('the imaging study picker', () => {
  it('lists the catalog without being typed into', async () => {
    renderDialog();

    // The complaint: nothing appeared until you typed, so the doctor had to
    // already know the name of the study they wanted.
    expect(await screen.findByText('Chest X-Ray PA')).toBeInTheDocument();
    expect(screen.getByText('USG Abdomen')).toBeInTheDocument();
    expect(screen.getByText('CT Brain Plain')).toBeInTheDocument();
  });

  it('asks for a page that holds the whole catalog', () => {
    renderDialog();
    expect(useImagingCatalog).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });

  it('matches on the modality label, not just the name', async () => {
    renderDialog();
    await userEvent.type(screen.getByPlaceholderText(/browse the list/i), 'ultrasound');

    // "USG Abdomen" does not contain the word ultrasound — the modality label
    // is the only thing that does.
    await waitFor(() => expect(screen.getByText('USG Abdomen')).toBeInTheDocument());
    expect(screen.queryByText('CT Brain Plain')).not.toBeInTheDocument();
  });

  it('matches on the service code', async () => {
    renderDialog();
    await userEvent.type(screen.getByPlaceholderText(/browse the list/i), 'CXR');

    await waitFor(() => expect(screen.getByText('Chest X-Ray PA')).toBeInTheDocument());
  });

  it('says the catalog is empty rather than showing a blank list', async () => {
    useImagingCatalog.mockReturnValue({ data: [], isLoading: false });
    renderDialog();

    // Not "no match" — nothing was typed. This is a setup problem and should
    // name its own fix.
    expect(await screen.findByText(/No imaging studies are configured/i)).toBeInTheDocument();
  });

  it('distinguishes no match from an empty catalog', async () => {
    renderDialog();
    await userEvent.type(screen.getByPlaceholderText(/browse the list/i), 'zzz');

    await waitFor(() => expect(screen.getByText(/No study matches/i)).toBeInTheDocument());
    expect(screen.queryByText(/No imaging studies are configured/i)).not.toBeInTheDocument();
  });
});
