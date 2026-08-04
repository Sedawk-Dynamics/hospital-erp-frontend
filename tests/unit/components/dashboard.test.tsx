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

    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
  });

  it('should display welcome message with user name', () => {
    mockUseDashboardStats.mockReturnValue({
      data: mockStats,
      isLoading: false,
      isError: false,
    });

    render(<DashboardPage />, { wrapper: createWrapper() });

    expect(screen.getAllByText(/welcome back, john/i).length).toBeGreaterThan(0);
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

    expect(screen.getAllByText('Total Patients').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1,500').length).toBeGreaterThan(0);
    expect(screen.getAllByText("Today's Appointments").length).toBeGreaterThan(0);
    expect(screen.getAllByText('45').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Available Beds').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100/300').length).toBeGreaterThan(0);
    // Rendered in more than one place now (stat card + summary strip).
    expect(screen.getAllByText("Today's Revenue").length).toBeGreaterThan(0);
    expect(screen.getAllByText('$50,000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pending Bills').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active Doctors').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Total Staff').length).toBeGreaterThan(0);
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
    // Skeletons use the shared shimmer utility (animate-pulse was the old one).
    const skeletons = container.querySelectorAll('.animate-shimmer, .animate-pulse');
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

    expect(screen.getAllByText(/failed to load dashboard data/i).length).toBeGreaterThan(0);
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

    expect(screen.getAllByText('Financial Overview').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Department Stats').length).toBeGreaterThan(0);
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

    expect(screen.getAllByText('Upcoming Appointments').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Patient Queue').length).toBeGreaterThan(0);
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

    expect(screen.getAllByText('Ward Occupancy').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pending Tasks').length).toBeGreaterThan(0);
  });

  it('should show welcome message without name when user is null', () => {
    mockUseAuthStore.mockReturnValue({ user: null });
    mockUseDashboardStats.mockReturnValue({
      data: mockStats,
      isLoading: false,
      isError: false,
    });

    render(<DashboardPage />, { wrapper: createWrapper() });

    expect(screen.getAllByText(/welcome back! here is an overview/i).length).toBeGreaterThan(0);
  });
});
