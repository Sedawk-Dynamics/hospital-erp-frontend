'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';
import type { Bill } from '@/types';
import { fullName } from '@/lib/person-name';

export default function BillingPage() {
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchBills = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/bills', {
        params: { page, limit: 10, search: debouncedSearch || undefined },
      });
      setBills(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch bills');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const columns: Column<Bill>[] = [
    {
      key: 'billNumber',
      label: 'Bill #',
      sortable: true,
      render: (bill) => (
        <button
          onClick={() => router.push(`/billing/${bill.id}`)}
          className="font-mono text-sm text-primary hover:underline font-medium"
        >
          {bill.billNumber}
        </button>
      ),
    },
    {
      key: 'patient',
      label: 'Patient',
      render: (bill) =>
        bill.patient
          ? fullName(bill.patient)
          : '-',
    },
    {
      key: 'total',
      label: 'Total',
      sortable: true,
      render: (bill) => (
        <span className="font-medium">${bill.total?.toFixed(2) || '0.00'}</span>
      ),
    },
    {
      key: 'paidAmount',
      label: 'Paid',
      render: (bill) => (
        <span className="text-emerald-600">${bill.paidAmount?.toFixed(2) || '0.00'}</span>
      ),
    },
    {
      key: 'balanceAmount',
      label: 'Balance',
      render: (bill) => (
        <span className={bill.balanceAmount > 0 ? 'text-destructive font-medium' : ''}>
          ${bill.balanceAmount?.toFixed(2) || '0.00'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (bill) => {
        try {
          return formatDate(bill.createdAt);
        } catch {
          return '-';
        }
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (bill) => <StatusBadge status={bill.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Manage patient bills and invoices"
        action={
          <Button
            variant="outline"
            onClick={() => router.push('/billing/payments')}
          >
            View Payments
          </Button>
        }
      />
      <DataTable
        columns={columns as any}
        data={bills as any}
        searchPlaceholder="Search bills by number or patient..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No bills found."
      />
    </div>
  );
}
