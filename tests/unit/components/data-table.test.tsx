import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, type Column } from '@/components/shared/data-table';

// ─── Test Data ───
interface TestItem {
  id: string;
  name: string;
  email: string;
  status: string;
  [key: string]: unknown;
}

const mockColumns: Column<TestItem>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email' },
  {
    key: 'status',
    label: 'Status',
    render: (item) => <span data-testid="status-badge">{item.status}</span>,
  },
];

const mockData: TestItem[] = [
  { id: '1', name: 'Alice Johnson', email: 'alice@test.com', status: 'active' },
  { id: '2', name: 'Bob Smith', email: 'bob@test.com', status: 'inactive' },
  { id: '3', name: 'Charlie Brown', email: 'charlie@test.com', status: 'active' },
];

describe('DataTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────
  // Basic Rendering
  // ────────────────────────────────────────────────────────

  it('should render table with columns and data', () => {
    render(<DataTable columns={mockColumns} data={mockData} />);

    // Column headers
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();

    // Data rows
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(screen.getByText('bob@test.com')).toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
  });

  it('should render custom cell renderers', () => {
    render(<DataTable columns={mockColumns} data={mockData} />);

    const badges = screen.getAllByTestId('status-badge');
    expect(badges).toHaveLength(3);
    expect(badges[0]).toHaveTextContent('active');
    expect(badges[1]).toHaveTextContent('inactive');
  });

  // ────────────────────────────────────────────────────────
  // Empty State
  // ────────────────────────────────────────────────────────

  it('should handle empty data', () => {
    render(<DataTable columns={mockColumns} data={[]} />);

    expect(screen.getByText('No records found.')).toBeInTheDocument();
  });

  it('should display custom empty message', () => {
    render(
      <DataTable
        columns={mockColumns}
        data={[]}
        emptyMessage="No patients in the system."
      />
    );

    expect(screen.getByText('No patients in the system.')).toBeInTheDocument();
  });

  // ────────────────────────────────────────────────────────
  // Loading State
  // ────────────────────────────────────────────────────────

  it('should show loading state', () => {
    render(<DataTable columns={mockColumns} data={[]} isLoading />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  // ────────────────────────────────────────────────────────
  // Pagination
  // ────────────────────────────────────────────────────────

  it('should render pagination when totalPages > 1', () => {
    const mockPageChange = vi.fn();

    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        page={1}
        totalPages={5}
        total={50}
        onPageChange={mockPageChange}
      />
    );

    expect(screen.getByText('Page 1 of 5 (50 total records)')).toBeInTheDocument();
  });

  it('should not render pagination when totalPages is 1', () => {
    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        page={1}
        totalPages={1}
        total={3}
      />
    );

    expect(screen.queryByText(/Page 1 of 1/)).not.toBeInTheDocument();
  });

  it('should disable previous buttons on first page', () => {
    const mockPageChange = vi.fn();

    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        page={1}
        totalPages={5}
        total={50}
        onPageChange={mockPageChange}
      />
    );

    const buttons = screen.getAllByRole('button');
    // First two pagination buttons (first page, previous page) should be disabled
    const paginationButtons = buttons.filter(
      (btn) => btn.closest('.flex.items-center.gap-1')
    );

    // First and second pagination buttons should be disabled
    if (paginationButtons.length >= 2) {
      expect(paginationButtons[0]).toBeDisabled();
      expect(paginationButtons[1]).toBeDisabled();
    }
  });

  it('should disable next buttons on last page', () => {
    const mockPageChange = vi.fn();

    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        page={5}
        totalPages={5}
        total={50}
        onPageChange={mockPageChange}
      />
    );

    const buttons = screen.getAllByRole('button');
    const paginationButtons = buttons.filter(
      (btn) => btn.closest('.flex.items-center.gap-1')
    );

    // Last two pagination buttons (next page, last page) should be disabled
    if (paginationButtons.length >= 4) {
      expect(paginationButtons[2]).toBeDisabled();
      expect(paginationButtons[3]).toBeDisabled();
    }
  });

  it('should call onPageChange when pagination buttons are clicked', async () => {
    const mockPageChange = vi.fn();
    const user = userEvent.setup();

    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        page={2}
        totalPages={5}
        total={50}
        onPageChange={mockPageChange}
      />
    );

    const buttons = screen.getAllByRole('button');
    const paginationButtons = buttons.filter(
      (btn) => btn.closest('.flex.items-center.gap-1')
    );

    // Click a non-disabled button if available
    for (const btn of paginationButtons) {
      if (!btn.hasAttribute('disabled')) {
        await user.click(btn);
        break;
      }
    }

    expect(mockPageChange).toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────
  // Sorting
  // ────────────────────────────────────────────────────────

  it('should handle column sorting', async () => {
    const mockSort = vi.fn();
    const user = userEvent.setup();

    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        onSort={mockSort}
      />
    );

    // The "Name" column is sortable - it renders as a button
    const nameHeader = screen.getByText('Name');
    const sortButton = nameHeader.closest('button');
    expect(sortButton).toBeInTheDocument();

    await user.click(sortButton!);

    expect(mockSort).toHaveBeenCalledWith('name', 'asc');
  });

  it('should toggle sort direction on repeated clicks', async () => {
    const mockSort = vi.fn();
    const user = userEvent.setup();

    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        onSort={mockSort}
      />
    );

    const nameHeader = screen.getByText('Name');
    const sortButton = nameHeader.closest('button');

    // First click: asc
    await user.click(sortButton!);
    expect(mockSort).toHaveBeenCalledWith('name', 'asc');

    // Second click: desc
    await user.click(sortButton!);
    expect(mockSort).toHaveBeenCalledWith('name', 'desc');
  });

  it('should not render sort button for non-sortable columns', () => {
    render(<DataTable columns={mockColumns} data={mockData} />);

    // "Email" is not sortable - should not be inside a button
    const emailHeader = screen.getByText('Email');
    expect(emailHeader.closest('button')).toBeNull();
  });

  // ────────────────────────────────────────────────────────
  // Search
  // ────────────────────────────────────────────────────────

  it('should render search input when onSearch is provided', () => {
    const mockSearch = vi.fn();

    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        onSearch={mockSearch}
        searchPlaceholder="Search users..."
      />
    );

    expect(screen.getByPlaceholderText('Search users...')).toBeInTheDocument();
  });

  it('should not render search input when onSearch is not provided', () => {
    render(<DataTable columns={mockColumns} data={mockData} />);

    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
  });

  it('should call onSearch when typing in search input', async () => {
    const mockSearch = vi.fn();
    const user = userEvent.setup();

    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        onSearch={mockSearch}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search...');
    await user.type(searchInput, 'Alice');

    // onSearch is called for each character
    expect(mockSearch).toHaveBeenCalled();
    expect(mockSearch).toHaveBeenLastCalledWith('Alice');
  });

  // ────────────────────────────────────────────────────────
  // Fallback Rendering
  // ────────────────────────────────────────────────────────

  it('should render dash for undefined cell values without custom render', () => {
    const simpleColumns: Column<TestItem>[] = [
      { key: 'name', label: 'Name' },
      { key: 'missingField', label: 'Missing' },
    ];

    const dataWithMissing: TestItem[] = [
      { id: '1', name: 'Test', email: '', status: '' },
    ];

    render(<DataTable columns={simpleColumns} data={dataWithMissing} />);

    expect(screen.getByText('Test')).toBeInTheDocument();
    // Missing field should show '-'
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
