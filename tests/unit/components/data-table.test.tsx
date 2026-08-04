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

// The pagination controls are icon-only buttons with no accessible name, and
// the column-sort buttons share their utility classes — so find them via the
// "Page X of Y" caption they sit beside rather than by class.
function paginationButtons(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll('button.h-8.w-8'),
  ) as HTMLButtonElement[];
}

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
    const { container } = render(<DataTable columns={mockColumns} data={[]} isLoading />);

    // Loading is a shimmer skeleton now, not the words "Loading...".
    expect(container.querySelectorAll('.animate-shimmer').length).toBeGreaterThan(0);
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

    // The caption is split across <span>s ("Page **1** of **5** (50 records)").
    expect(
      screen.getByText((_, el) => /Page\s*1\s*of\s*5/.test(el?.textContent ?? '') && el?.tagName === 'P'),
    ).toBeInTheDocument();
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

    // first-page and previous-page are dead on page 1
    const btns = paginationButtons();
    expect(btns.length).toBeGreaterThanOrEqual(4);
    expect(btns[0]).toBeDisabled();
    expect(btns[1]).toBeDisabled();
    expect(btns[2]).not.toBeDisabled();
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

    // next-page and last-page are dead on the final page
    const btns = paginationButtons();
    expect(btns).toHaveLength(4);
    expect(btns[2]).toBeDisabled();
    expect(btns[3]).toBeDisabled();
    expect(btns[0]).not.toBeDisabled();
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

    // On page 2 of 5 every control is live: first, previous, next, last.
    const [first, prev, next, last] = paginationButtons();

    await user.click(next);
    expect(mockPageChange).toHaveBeenCalledWith(3);

    await user.click(prev);
    expect(mockPageChange).toHaveBeenCalledWith(1);

    await user.click(first);
    expect(mockPageChange).toHaveBeenCalledWith(1);

    await user.click(last);
    expect(mockPageChange).toHaveBeenCalledWith(5);
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
