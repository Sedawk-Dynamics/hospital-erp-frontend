'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type Column } from '@/components/shared/data-table';
import { useSupportTickets, useUpdateTicket, type SupportTicket } from '@/hooks/use-super-admin';
import { formatDate } from '@/lib/date-utils';

const STATUS_OPTIONS = ['all', 'open', 'in_progress', 'resolved', 'escalated', 'closed'];
const PRIORITY_OPTIONS = ['all', 'low', 'medium', 'high', 'critical'];

const statusColors: Record<string, string> = {
  open: 'bg-secondary/10 text-secondary',
  in_progress: 'bg-primary/10 text-primary',
  resolved: 'bg-primary/10 text-primary',
  escalated: 'bg-error-container text-on-error-container',
  closed: 'bg-surface-container-high text-on-surface-variant',
};

const priorityColors: Record<string, string> = {
  low: 'bg-surface-container-high text-on-surface-variant',
  medium: 'bg-primary/10 text-primary',
  high: 'bg-secondary/10 text-secondary',
  critical: 'bg-error-container text-on-error-container',
};

export default function SupportPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const { data, isLoading } = useSupportTickets({
    page,
    limit: 10,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    priority: priorityFilter !== 'all' ? priorityFilter : undefined,
  });

  const updateTicket = useUpdateTicket();

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateTicket.mutateAsync({ id, status });
      toast.success('Ticket status updated');
    } catch {
      toast.error('Failed to update ticket');
    }
  };

  const columns: Column<SupportTicket>[] = [
    {
      key: 'subject',
      label: 'Subject',
      render: (item) => (
        <div>
          <p className="font-label text-sm font-bold text-on-surface">{item.subject}</p>
          {item.description && (
            <p className="font-label text-[10px] text-on-surface-variant line-clamp-1">{item.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (item) => (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityColors[item.priority] || ''}`}>
          {item.priority}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[item.status] || ''}`}>
          {item.status.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (item) => (
        <span className="font-label text-sm text-on-surface">
          {formatDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item) => (
        <Select
          value={item.status}
          onValueChange={(v) => v && handleStatusChange(item.id, v)}
          disabled={updateTicket.isPending}
        >
          <SelectTrigger className="h-8 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-xl font-bold">Support Tickets</h1>
        <p className="font-label text-sm text-on-surface-variant">Manage support requests from hospitals</p>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 flex gap-4">
        <div className="w-40">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? 'all'); setPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s === 'all' ? 'All Status' : s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v ?? 'all'); setPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>{p === 'all' ? 'All Priority' : p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={(data?.data ?? []) as unknown as Record<string, unknown>[]}
        isLoading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        total={data?.meta?.total ?? 0}
        onPageChange={setPage}
        emptyMessage="No support tickets found."
      />
    </div>
  );
}
