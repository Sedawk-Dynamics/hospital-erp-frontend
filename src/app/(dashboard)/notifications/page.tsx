'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';

interface Notification {
  id: string;
  userId: string;
  type: 'info' | 'warning' | 'alert' | 'reminder';
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string;
  link?: string;
  createdAt: string;
  updatedAt: string;
}

const typeBadgeStyles: Record<Notification['type'], string> = {
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-amber-100 text-amber-800',
  alert: 'bg-red-100 text-red-800',
  reminder: 'bg-purple-100 text-purple-800',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/communication/notifications', {
        params: { page, limit: 10, search: debouncedSearch || undefined },
      });
      setNotifications(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      await apiClient.patch(`/communication/notifications/${id}/read`);
      toast.success('Notification marked as read');
      fetchNotifications();
    } catch {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.patch('/communication/notifications/read-all');
      toast.success('All notifications marked as read');
      fetchNotifications();
    } catch {
      toast.error('Failed to mark all notifications as read');
    }
  };

  const columns: Column<Notification>[] = [
    {
      key: 'type',
      label: 'Type',
      className: 'w-[100px]',
      render: (n) => (
        <Badge className={`font-medium border-0 capitalize ${typeBadgeStyles[n.type]}`}>
          {n.type}
        </Badge>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (n) => <span className="font-medium">{n.title}</span>,
    },
    {
      key: 'message',
      label: 'Message',
      render: (n) => (
        <span className="text-muted-foreground truncate max-w-[300px] block">
          {n.message}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (n) => (
        <span className="text-muted-foreground text-sm whitespace-nowrap">
          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: 'isRead',
      label: 'Read',
      className: 'w-[60px]',
      render: (n) => (
        <span className="flex items-center justify-center">
          {!n.isRead && (
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          )}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[120px]',
      render: (n) =>
        !n.isRead ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleMarkRead(n.id)}
          >
            Mark Read
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="View and manage your notifications"
        action={
          <Button onClick={handleMarkAllRead} className="gap-2">
            <CheckCheck className="h-4 w-4" />
            Mark All Read
          </Button>
        }
      />
      <DataTable
        columns={columns as any}
        data={notifications as any}
        searchPlaceholder="Search notifications..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No notifications found."
      />
    </div>
  );
}
