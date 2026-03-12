import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DashboardStats } from '@/hooks/use-api';

// ─── Mock data ───
const mockStats: DashboardStats = {
  patientStats: {
    total: 1500,
    todayNew: 12,
    inpatient: 200,
    outpatient: 1300,
  },
  appointmentStats: {
    todayTotal: 45,
    completed: 20,
    pending: 15,
    cancelled: 10,
  },
  billingStats: {
    todayRevenue: 50000,
    pendingBills: 30,
    totalRevenue: 2500000,
  },
  bedStats: {
    total: 300,
    occupied: 200,
    available: 100,
  },
  staffStats: {
    totalDoctors: 50,
    totalNurses: 100,
    totalStaff: 200,
  },
};

const mockUser = {
  id: 'user-1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@hospital.com',
  isActive: true,
  emailVerified: true,
  role: { id: 'r1', name: 'Admin', slug: 'admin', permissions: [], tenantId: 't1', createdAt: '', updatedAt: '' },
  tenant: { id: 't1', name: 'Demo Hospital', slug: 'demo-hospital', isActive: true, createdAt: '', updatedAt: '' },
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

// ─── Mock hooks ───
const mockUseDashboardStats = vi.fn();
vi.mock('@/hooks/use-api', () => ({
  useDashboardStats: (...args: unknown[]) => mockUseDashboardStats(...args),
}));

const mockUseAuthStore = vi.fn();
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector?: any) => {
    if (selector) return selector(mockUseAuthStore());
    return mockUseAuthStore();
  },
}));

// ─── Mock shared components ───
vi.mock('@/components/shared/page-header', () => ({
  PageHeader: ({ title, description }: any) => (
    <div>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  ),
}));

import DashboardPage from '@/app/(dashboard)/dashboard/page';

// ─── Helper ───
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue({ user: mockUser });
  });

  // ────────────────────────────────────────────────────────
  // Dashboard Title
  // ────────────────────────────────────────────────────────

  it('should render dashboard title', () => {
    mockUseDashboardStats.mockReturnValue({
      data: mockStats,
      isLoading: false,
      isError: false,
    });

    render(<DashboardPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should display welcome message with user name', () => {
    mockUseDashboardStats.mockReturnValue({
      data: mockStats,
      isLoading: false,
      isError: false,
    });

    render(<DashboardPage />, { wrapper: createWrapper() });

    expect(screen.getByText(/welcome back, john/i)).toBeInTheDocument();
  });

  // ────────────────────────────────────────────────────────
  // Stat Cards
  // ────────────────────────────────────────────────────────

  it('should display stat cards when data is loaded', () => {
    mockUseDashboardStats.mockReturnValue({
      data: mockStats,
      isLoading: false,
      isError: false,
    });

    render(<DashboardPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Total Patients')).toBeInTheDocument();
    expect(screen.getByText('1,500')).toBeInTheDocument();
    expect(screen.getByText("Today's Appointments")).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('Available Beds')).toBeInTheDocument();
    expect(screen.getByText('100/300')).toBeInTheDocument();
    expect(screen.getByText("Today's Revenue")).toBeInTheDocument();
    expect(screen.getByText('$50,000')).toBeInTheDocument();
    expect(screen.getByText('Pending Bills')).toBeInTheDocument();
    expect(screen.getByText('Active Doctors')).toBeInTheDocument();
    expect(screen.getByText('Total Staff')).toBeInTheDocument();
  });

  // ────────────────────────────────────────────────────────
  // Loading State
  // ────────────────────────────────────────────────────────

  it('should show loading state', () => {
    mockUseDashboardStats.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const { container } = render(<DashboardPage />, { wrapper: createWrapper() });

    // Skeletons should be rendered (pulse animations)
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // ────────────────────────────────────────────────────────
  // Error State
  // ────────────────────────────────────────────────────────

  it('should handle API errors', () => {
    mockUseDashboardStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<DashboardPage />, { wrapper: createWrapper() });

    expect(screen.getByText(/failed to load dashboard data/i)).toBeInTheDocument();
  });

  // ────────────────────────────────────────────────────────
  // Role-specific Sections
  // ────────────────────────────────────────────────────────

  it('should show admin section for admin users', () => {
    mockUseDashboardStats.mockReturnValue({
      data: mockStats,
      isLoading: false,
      isError: false,
    });

    render(<DashboardPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Financial Overview')).toBeInTheDocument();
    expect(screen.getByText('Department Stats')).toBeInTheDocument();
  });

  it('should show doctor section for doctor users', () => {
    mockUseAuthStore.mockReturnValue({
      user: { ...mockUser, role: { ...mockUser.role, slug: 'doctor' } },
    });
    mockUseDashboardStats.mockReturnValue({
      data: mockStats,
      isLoading: false,
      isError: false,
    });

    render(<DashboardPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Upcoming Appointments')).toBeInTheDocument();
    expect(screen.getByText('Patient Queue')).toBeInTheDocument();
  });

  it('should show nurse section for nurse users', () => {
    mockUseAuthStore.mockReturnValue({
      user: { ...mockUser, role: { ...mockUser.role, slug: 'nurse' } },
    });
    mockUseDashboardStats.mockReturnValue({
      data: mockStats,
      isLoading: false,
      isError: false,
    });

    render(<DashboardPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Ward Occupancy')).toBeInTheDocument();
    expect(screen.getByText('Pending Tasks')).toBeInTheDocument();
  });

  it('should show welcome message without name when user is null', () => {
    mockUseAuthStore.mockReturnValue({ user: null });
    mockUseDashboardStats.mockReturnValue({
      data: mockStats,
      isLoading: false,
      isError: false,
    });

    render(<DashboardPage />, { wrapper: createWrapper() });

    expect(screen.getByText(/welcome back! here is an overview/i)).toBeInTheDocument();
  });
});
