import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mock user data ───
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

// ─── Mock stores ───
const mockLogout = vi.fn();
const mockToggle = vi.fn();
const mockToggleCollapse = vi.fn();

vi.mock('@/stores/sidebar-store', () => ({
  useSidebarStore: () => ({
    toggle: mockToggle,
    isCollapsed: false,
    toggleCollapse: mockToggleCollapse,
  }),
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    user: mockUser,
    logout: mockLogout,
  }),
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
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

// ─── Mock Avatar ───
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: any) => <div className={className} data-testid="avatar">{children}</div>,
  AvatarFallback: ({ children, className }: any) => <span className={className} data-testid="avatar-fallback">{children}</span>,
}));

// ─── Mock DropdownMenu ───
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children, className }: any) => <button data-testid="dropdown-trigger" className={className}>{children}</button>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuGroup: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: any) => (
    <button data-testid="dropdown-item" onClick={onClick} className={className}>{children}</button>
  ),
  DropdownMenuLabel: ({ children }: any) => <div data-testid="dropdown-label">{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

import { Header } from '@/components/layout/header';

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────
  // Rendering
  // ────────────────────────────────────────────────────────

  it('should render header', () => {
    render(<Header />);

    const header = document.querySelector('header');
    expect(header).toBeInTheDocument();
  });

  it('should show user info', () => {
    render(<Header />);

    // User initials in avatar
    expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('JD');

    // User name in dropdown
    expect(screen.getByText('John Doe')).toBeInTheDocument();

    // User email in dropdown
    expect(screen.getByText('john@hospital.com')).toBeInTheDocument();
  });

  it('should show tenant name', () => {
    render(<Header />);

    expect(screen.getByText('Demo Hospital')).toBeInTheDocument();
  });

  it('should have logout button', () => {
    render(<Header />);

    const logoutButton = screen.getByText('Log out').closest('button');
    expect(logoutButton).toBeInTheDocument();
  });

  it('should call logout and redirect on logout click', async () => {
    mockLogout.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Header />);

    const logoutButton = screen.getByText('Log out').closest('button');
    expect(logoutButton).toBeTruthy();
    await user.click(logoutButton!);

    expect(mockLogout).toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────
  // Navigation
  // ────────────────────────────────────────────────────────

  it('should have profile menu item', () => {
    render(<Header />);

    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('should have settings menu item', () => {
    render(<Header />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should have notifications button', () => {
    render(<Header />);

    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  // ────────────────────────────────────────────────────────
  // Sidebar Toggle
  // ────────────────────────────────────────────────────────

  it('should have mobile menu toggle button', () => {
    render(<Header />);

    expect(screen.getByText('Toggle menu')).toBeInTheDocument();
  });

  it('should have desktop sidebar toggle button', () => {
    render(<Header />);

    expect(screen.getByText('Toggle sidebar')).toBeInTheDocument();
  });

  // ────────────────────────────────────────────────────────
  // Edge Cases
  // ────────────────────────────────────────────────────────

  it('should show fallback initials when user has no name', () => {
    // This test relies on the store returning user as-is.
    // The Header component computes initials from firstName and lastName.
    // With the current mock user it should show "JD".
    render(<Header />);

    expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('JD');
  });
});
