'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '@/lib/date-utils';
import {
  ArrowLeftRight, Search, Plus, ArrowRight, Clock, CheckCircle2, XCircle, Package,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { apiGet } from '@/lib/api';

interface SupplyRequest extends Record<string, unknown> {
  id: string;
  itemId?: string;
  item?: {
    id: string;
    name: string;
    category?: string;
  };
  fromDepartment?: string;
  toDepartment?: string;
  quantity: number;
  unit?: string;
  status: string;
  requestedById?: string;
  requestedBy?: {
    firstName: string;
    lastName: string;
  };
  approvedById?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const statCards = [
  { label: 'Total Transfers', icon: ArrowLeftRight, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { label: 'Pending', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  { label: 'Approved', icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  { label: 'Rejected', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
];

const columns: Column<SupplyRequest>[] = [
  {
    key: 'item',
    label: 'Item',
    render: (item) => (
      <div>
        <p className="font-medium text-foreground">{item.item?.name ?? '-'}</p>
        {item.item?.category && <p className="text-xs text-muted-foreground">{item.item.category}</p>}
      </div>
    ),
  },
  {
    key: 'transfer',
    label: 'Transfer',
    render: (item) => (
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{item.fromDepartment || 'OT Store'}</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{item.toDepartment || 'OT'}</span>
      </div>
    ),
  },
  {
    key: 'quantity',
    label: 'Quantity',
    render: (item) => (
      <span className="font-medium">{item.quantity} {item.unit || 'units'}</span>
    ),
  },
  {
    key: 'requestedBy',
    label: 'Requested By',
    render: (item) =>
      item.requestedBy
        ? `${item.requestedBy.firstName} ${item.requestedBy.lastName}`
        : '-',
  },
  {
    key: 'status',
    label: 'Status',
    render: (item) => <StatusBadge status={item.status as string} />,
  },
  {
    key: 'createdAt',
    label: 'Date',
    sortable: true,
    render: (item) => formatDate(item.createdAt as string),
  },
];

export default function OTStockTransferPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['ot', 'supply-requests', { page, search }],
    queryFn: async () => {
      const response = await apiGet<SupplyRequest[]>('/inventory/supply-requests', {
        params: { page, limit: 20, search: search || undefined },
      });
      return { data: response.data, meta: response.meta };
    },
  });

  const requests = (data?.data ?? []) as SupplyRequest[];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="OT Stock Transfer"
        description="Manage stock transfer requests between departments"
        action={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Transfer Request
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
          placeholder="Search by item, department..."
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
        emptyMessage="No stock transfer requests found."
      />
    </div>
  );
}
