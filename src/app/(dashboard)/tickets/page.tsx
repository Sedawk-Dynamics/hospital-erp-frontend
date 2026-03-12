'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';

interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: 'technical' | 'billing' | 'clinical' | 'general';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  reportedById: string;
  reportedBy?: { firstName: string; lastName: string };
  assignedToId?: string;
  assignedTo?: { firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

const categoryColors: Record<string, string> = {
  technical: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  billing: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  clinical: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  general: 'bg-secondary text-secondary-foreground',
};

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/reports/support-tickets', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        },
      });
      setTickets(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch support tickets');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const columns: Column<SupportTicket>[] = [
    {
      key: 'ticketNumber',
      label: 'Ticket #',
      sortable: true,
      render: (ticket) => (
        <Badge variant="outline" className="font-mono text-xs">
          {ticket.ticketNumber}
        </Badge>
      ),
    },
    {
      key: 'subject',
      label: 'Subject',
      render: (ticket) => (
        <span className="font-medium">{ticket.subject}</span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (ticket) => (
        <Badge className={`border-0 capitalize ${categoryColors[ticket.category] || ''}`}>
          {ticket.category}
        </Badge>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (ticket) => <StatusBadge status={ticket.priority} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (ticket) => <StatusBadge status={ticket.status} />,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (ticket) => {
        try {
          return format(new Date(ticket.createdAt), 'MMM dd, yyyy');
        } catch {
          return '-';
        }
      },
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (ticket) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/tickets/${ticket.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Tickets"
        description="Manage support and maintenance tickets"
        action={
          <Button onClick={() => router.push('/tickets/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Ticket
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val ?? 'all'); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={priorityFilter} onValueChange={(val) => { setPriorityFilter(val ?? 'all'); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns as any}
        data={tickets as any}
        searchPlaceholder="Search tickets by number or subject..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No support tickets found. Create your first ticket to get started."
      />
    </div>
  );
}
