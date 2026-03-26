'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';

interface Message {
  id: string;
  senderId: string;
  sender: { firstName: string; lastName: string };
  recipientId: string;
  recipient: { firstName: string; lastName: string };
  subject?: string;
  content: string;
  isRead: boolean;
  readAt?: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/communication/messages', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
        },
      });
      setMessages(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch messages');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const formatMessageDate = (dateStr: string) => {
    try {
      return formatRelativeDate(dateStr);
    } catch {
      return dateStr;
    }
  };

  const columns: Column<Message>[] = [
    {
      key: 'sender',
      label: 'From',
      render: (msg) => (
        <span className={msg.isRead ? '' : 'font-semibold'}>
          {msg.sender?.firstName} {msg.sender?.lastName}
        </span>
      ),
    },
    {
      key: 'subject',
      label: 'Subject',
      render: (msg) => (
        <span
          className={`block max-w-[200px] truncate ${msg.isRead ? '' : 'font-medium'}`}
          title={msg.subject || '(No subject)'}
        >
          {msg.subject || '(No subject)'}
        </span>
      ),
    },
    {
      key: 'content',
      label: 'Preview',
      render: (msg) => (
        <span className="block max-w-[250px] truncate text-muted-foreground">
          {msg.content}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (msg) => (
        <span className={msg.isRead ? 'text-muted-foreground' : ''}>
          {formatMessageDate(msg.createdAt)}
        </span>
      ),
    },
    {
      key: 'isRead',
      label: 'Status',
      render: (msg) =>
        msg.isRead ? null : (
          <Badge variant="default" className="text-[10px] px-1.5 py-0">
            New
          </Badge>
        ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (msg) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            if (!msg.isRead) {
              try {
                await apiClient.patch(`/communication/messages/${msg.id}/read`);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === msg.id ? { ...m, isRead: true, readAt: new Date().toISOString() } : m
                  )
                );
              } catch {
                // ignore read-mark failure silently
              }
            }
            toast.info(
              `Message from ${msg.sender?.firstName} ${msg.sender?.lastName}: ${msg.content?.slice(0, 120) || '(empty)'}`,
            );
          }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="Internal messaging and communication"
        action={
          <Button className="gap-2" onClick={() => toast.info('New message composer coming soon')}>
            <Plus className="h-4 w-4" />
            New Message
          </Button>
        }
      />

      <DataTable
        columns={columns as any}
        data={messages as any}
        searchPlaceholder="Search messages..."
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No messages found."
      />
    </div>
  );
}
