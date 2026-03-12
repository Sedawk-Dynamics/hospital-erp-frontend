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
  usePathname: () => '/appointments',
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
                <td>{item.appointmentDate}</td>
                <td>{item.status}</td>
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

// ─── Mock shadcn Select components ───
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select">{children}</div>
  ),
  SelectTrigger: ({ children }: any) => <button data-testid="select-trigger">{children}</button>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
}));

import AppointmentsPage from '@/app/(dashboard)/appointments/page';

describe('Appointments Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────
  // Rendering
  // ────────────────────────────────────────────────────────

  it('should render appointments page', async () => {
    mockGet.mockResolvedValue({
      data: { data: [], meta: { page: 1, totalPages: 1, total: 0 } },
    });

    render(<AppointmentsPage />);

    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(screen.getByText(/manage and schedule patient appointments/i)).toBeInTheDocument();
  });

  it('should render appointments table', async () => {
    const mockAppointments = [
      {
        id: 'apt-1',
        patientId: 'p1',
        patient: { firstName: 'Alice', lastName: 'Smith' },
        doctorId: 'd1',
        doctor: { user: { firstName: 'Bob', lastName: 'Jones' } },
        appointmentDate: '2024-03-15',
        startTime: '09:00',
        endTime: '09:30',
        type: 'consultation',
        status: 'scheduled',
      },
    ];

    mockGet.mockResolvedValue({
      data: {
        data: mockAppointments,
        meta: { page: 1, totalPages: 1, total: 1 },
      },
    });

    render(<AppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
      expect(screen.getByText('2024-03-15')).toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    render(<AppointmentsPage />);

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('should render new appointment button', async () => {
    mockGet.mockResolvedValue({
      data: { data: [], meta: { page: 1, totalPages: 1, total: 0 } },
    });

    render(<AppointmentsPage />);

    expect(screen.getByText(/new appointment/i)).toBeInTheDocument();
  });

  it('should handle empty state', async () => {
    mockGet.mockResolvedValue({
      data: { data: [], meta: { page: 1, totalPages: 1, total: 0 } },
    });

    render(<AppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('empty')).toBeInTheDocument();
      expect(screen.getByText(/no appointments found/i)).toBeInTheDocument();
    });
  });

  it('should show error toast when fetch fails', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    render(<AppointmentsPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to fetch appointments');
    });
  });

  it('should call API with correct endpoint and params', async () => {
    mockGet.mockResolvedValue({
      data: { data: [], meta: { page: 1, totalPages: 1, total: 0 } },
    });

    render(<AppointmentsPage />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/appointments', expect.objectContaining({
        params: expect.objectContaining({ page: 1, limit: 10 }),
      }));
    });
  });

  it('should render status filter', () => {
    mockGet.mockResolvedValue({
      data: { data: [], meta: { page: 1, totalPages: 1, total: 0 } },
    });

    render(<AppointmentsPage />);

    expect(screen.getByTestId('select')).toBeInTheDocument();
  });
});
