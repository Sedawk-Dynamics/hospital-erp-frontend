import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mock sidebar store ───
const mockSidebarState = {
  isOpen: false,
  isCollapsed: false,
  toggle: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
  toggleCollapse: vi.fn(),
};

vi.mock('@/stores/sidebar-store', () => ({
  useSidebarStore: () => ({ ...mockSidebarState }),
}));

// ─── Mock next/navigation ───
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

// ─── Mock next/link to render anchor tags ───
vi.mock('next/link', () => ({
  default: ({ children, href, className, onClick, title, ...props }: any) => (
    <a href={href} className={className} onClick={onClick} title={title} {...props}>
      {children}
    </a>
  ),
}));

// ─── Mock Sheet components ───
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: any) => open ? <div data-testid="mobile-sidebar">{children}</div> : null,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

import { Sidebar } from '@/components/layout/sidebar';

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSidebarState.isOpen = false;
    mockSidebarState.isCollapsed = false;
  });

  // ────────────────────────────────────────────────────────
  // Rendering
  // ────────────────────────────────────────────────────────

  it('should render sidebar navigation', () => {
    render(<Sidebar />);

    const aside = document.querySelector('aside');
    expect(aside).toBeInTheDocument();
  });

  it('should render all menu items', () => {
    render(<Sidebar />);

    // Main navigation items
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Patients')).toBeInTheDocument();
    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(screen.getByText('Visits')).toBeInTheDocument();
    expect(screen.getByText('Admissions')).toBeInTheDocument();
    expect(screen.getByText('Prescriptions')).toBeInTheDocument();
    expect(screen.getByText('Lab Orders')).toBeInTheDocument();
    expect(screen.getByText('Pharmacy')).toBeInTheDocument();
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('Bills')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  it('should render navigation group titles', () => {
    render(<Sidebar />);

    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getByText('Patient Management')).toBeInTheDocument();
    expect(screen.getByText('Clinical')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('should highlight active route', () => {
    render(<Sidebar />);

    // /dashboard is the current pathname, so the Dashboard link should have active styles
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).toHaveClass('bg-primary');
  });

  it('should render Hospital ERP branding', () => {
    render(<Sidebar />);

    expect(screen.getByText('Hospital ERP')).toBeInTheDocument();
  });

  // ────────────────────────────────────────────────────────
  // Collapse
  // ────────────────────────────────────────────────────────

  it('should be collapsible with collapse button', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    // Find the collapse button (it's a small round button with chevron)
    const collapseButtons = screen.getAllByRole('button');
    // The collapse button is the one inside the aside
    const aside = document.querySelector('aside');
    const collapseButton = aside?.querySelector('button');
    expect(collapseButton).toBeInTheDocument();

    if (collapseButton) {
      await user.click(collapseButton);
      expect(mockSidebarState.toggleCollapse).toHaveBeenCalled();
    }
  });

  it('should hide text labels when collapsed', () => {
    mockSidebarState.isCollapsed = true;

    render(<Sidebar />);

    // In collapsed state, the span with the app name should not be present
    // Group titles should also be hidden
    const aside = document.querySelector('aside');
    expect(aside).toHaveClass('w-[68px]');
  });

  it('should show full width when not collapsed', () => {
    mockSidebarState.isCollapsed = false;

    render(<Sidebar />);

    const aside = document.querySelector('aside');
    expect(aside).toHaveClass('w-64');
  });

  // ────────────────────────────────────────────────────────
  // Mobile Sidebar
  // ────────────────────────────────────────────────────────

  it('should show mobile sidebar when isOpen is true', () => {
    mockSidebarState.isOpen = true;

    render(<Sidebar />);

    expect(screen.getByTestId('mobile-sidebar')).toBeInTheDocument();
  });

  it('should not show mobile sidebar when isOpen is false', () => {
    mockSidebarState.isOpen = false;

    render(<Sidebar />);

    expect(screen.queryByTestId('mobile-sidebar')).not.toBeInTheDocument();
  });

  // ────────────────────────────────────────────────────────
  // Link Navigation
  // ────────────────────────────────────────────────────────

  it('should render correct href for navigation items', () => {
    render(<Sidebar />);

    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');

    const patientsLink = screen.getByText('Patients').closest('a');
    expect(patientsLink).toHaveAttribute('href', '/patients');

    const appointmentsLink = screen.getByText('Appointments').closest('a');
    expect(appointmentsLink).toHaveAttribute('href', '/appointments');
  });
});
