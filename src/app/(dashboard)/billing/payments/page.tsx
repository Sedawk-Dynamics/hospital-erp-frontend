'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';
import type { Payment } from '@/types';
import { ArrowLeft } from 'lucide-react';

export default function PaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/payments', {
        params: { page, limit: 10, search: debouncedSearch || undefined },
      });
      setPayments(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch payments');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const columns: Column<Payment>[] = [
    {
      key: 'id',
      label: 'Payment ID',
      render: (payment) => (
        <span className="font-mono text-sm">{payment.id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'billId',
      label: 'Bill',
      render: (payment) => (
        <button
          onClick={() => router.push(`/billing/${payment.billId}`)}
          className="text-primary hover:underline text-sm"
        >
          View Bill
        </button>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      render: (payment) => (
        <span className="font-medium">${payment.amount?.toFixed(2)}</span>
      ),
    },
    {
      key: 'method',
      label: 'Method',
      render: (payment) => (
        <span className="capitalize">{payment.method?.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'transactionId',
      label: 'Transaction ID',
      render: (payment) => (
        <span className="font-mono text-xs">{payment.transactionId || '-'}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (payment) => {
        try {
          return format(new Date(payment.createdAt), 'MMM dd, yyyy HH:mm');
        } catch {
          return '-';
        }
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (payment) => <StatusBadge status={payment.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="View all payment transactions"
        action={
          <Button variant="outline" onClick={() => router.push('/billing')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Bills
          </Button>
        }
      />
      <DataTable
        columns={columns as any}
        data={payments as any}
        searchPlaceholder="Search payments..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No payments found."
      />
    </div>
  );
}
