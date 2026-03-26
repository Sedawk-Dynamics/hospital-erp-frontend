'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/date-utils';
import { CreditCard, Search, Download, IndianRupee, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { useOTRequests, type OTRequest } from '@/hooks/use-ot';

const statCards = [
  { label: 'Total Billing', icon: IndianRupee, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { label: 'Paid', icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  { label: 'Pending', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  { label: 'Cancelled', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
];

const columns: Column<OTRequest & Record<string, unknown>>[] = [
  {
    key: 'patient',
    label: 'Patient',
    render: (item) => (
      <div>
        <p className="font-medium text-foreground">
          {item.patient ? `${item.patient.firstName} ${item.patient.lastName}` : '-'}
        </p>
        {item.patient?.uhid && (
          <p className="text-xs text-muted-foreground">{item.patient.uhid}</p>
        )}
      </div>
    ),
  },
  {
    key: 'surgeryName',
    label: 'Surgery',
    sortable: true,
  },
  {
    key: 'surgeon',
    label: 'Surgeon',
    render: (item) =>
      item.surgeon?.user
        ? `Dr. ${item.surgeon.user.firstName} ${item.surgeon.user.lastName}`
        : '-',
  },
  {
    key: 'scheduledDate',
    label: 'Date',
    sortable: true,
    render: (item) =>
      item.scheduledDate ? formatDate(item.scheduledDate as string) : '-',
  },
  {
    key: 'billingAmount',
    label: 'Amount',
    render: (item) =>
      item.billingAmount != null ? `Rs. ${Number(item.billingAmount).toLocaleString('en-IN')}` : '-',
  },
  {
    key: 'billingStatus',
    label: 'Payment Status',
    render: (item) =>
      item.billingStatus ? <StatusBadge status={item.billingStatus as string} /> : <StatusBadge status="pending" />,
  },
  {
    key: 'status',
    label: 'OT Status',
    render: (item) => <StatusBadge status={item.status as string} />,
  },
];

export default function OTTransactionsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useOTRequests({ page, limit: 20, search: search || undefined });
  const requests = (data?.data ?? []) as (OTRequest & Record<string, unknown>)[];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="OT Billing Transactions"
        description="View and manage OT billing transactions and payment records"
        action={
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4 border-primary ${card.bgColor} transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white/80 p-2">
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="font-headline text-3xl font-extrabold">0</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search patient, surgery..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={requests}
        isLoading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        total={data?.meta?.total ?? 0}
        onPageChange={setPage}
        emptyMessage="No OT billing transactions found."
      />
    </div>
  );
}
