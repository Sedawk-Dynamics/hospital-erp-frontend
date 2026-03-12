import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

// ─── Mock apiClient ───
const mockGet = vi.fn();
vi.mock('@/lib/api-client', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

// ─── Mock next/navigation ───
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/patients',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

// ─── Mock useDebounce ───
vi.mock('@/hooks/use-debounce', () => ({
  useDebounce: (value: string) => value,
}));

// ─── Mock shared components ───
vi.mock('@/components/shared/page-header', () => ({
  PageHeader: ({ title, description, action }: any) => (
    <div>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {action}
    </div>
  ),
}));

vi.mock('@/components/shared/data-table', () => ({
  DataTable: ({ data, isLoading, emptyMessage, columns }: any) => (
    <div data-testid="data-table">
      {isLoading && <div data-testid="loading">Loading...</div>}
      {!isLoading && data.length === 0 && <div data-testid="empty">{emptyMessage}</div>}
      {!isLoading && data.length > 0 && (
        <table>
          <thead>
            <tr>
              {columns.map((col: any) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item: any, i: number) => (
              <tr key={item.id || i}>
                <td>{item.mrn}</td>
                <td>{item.firstName} {item.lastName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  ),
  Column: {},
}));

vi.mock('@/components/shared/status-badge', () => ({
  StatusBadge: ({ status }: any) => <span>{status}</span>,
}));

import PatientsPage from '@/app/(dashboard)/patients/page';

describe('Patients Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────
  // Rendering
  // ────────────────────────────────────────────────────────

  it('should render patients list page', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [],
        meta: { page: 1, totalPages: 1, total: 0 },
      },
    });

    render(<PatientsPage />);

    expect(screen.getByText('Patients')).toBeInTheDocument();
    expect(screen.getByText(/manage patient records/i)).toBeInTheDocument();
  });

  it('should render data table', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 'p1',
            mrn: 'MRN001',
            firstName: 'Alice',
            lastName: 'Smith',
            gender: 'female',
            dateOfBirth: '1990-01-15',
            phone: '1234567890',
            bloodGroup: 'A+',
            isActive: true,
          },
        ],
        meta: { page: 1, totalPages: 1, total: 1 },
      },
    });

    render(<PatientsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    // Mock a pending promise (never resolves during test)
    mockGet.mockReturnValue(new Promise(() => {}));

    render(<PatientsPage />);

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('should render add patient button', async () => {
    mockGet.mockResolvedValue({
      data: { data: [], meta: { page: 1, totalPages: 1, total: 0 } },
    });

    render(<PatientsPage />);

    expect(screen.getByText(/add patient/i)).toBeInTheDocument();
  });

  it('should handle empty state', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [],
        meta: { page: 1, totalPages: 1, total: 0 },
      },
    });

    render(<PatientsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('empty')).toBeInTheDocument();
      expect(screen.getByText(/no patients found/i)).toBeInTheDocument();
    });
  });

  it('should show error toast when fetch fails', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    render(<PatientsPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to fetch patients');
    });
  });

  it('should call API with correct endpoint', async () => {
    mockGet.mockResolvedValue({
      data: { data: [], meta: { page: 1, totalPages: 1, total: 0 } },
    });

    render(<PatientsPage />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/patients', expect.objectContaining({
        params: expect.objectContaining({ page: 1, limit: 10 }),
      }));
    });
  });
});
