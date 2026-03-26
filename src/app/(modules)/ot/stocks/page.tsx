'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Search, AlertTriangle, Package, CheckCircle2, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { apiGet } from '@/lib/api';

interface InventoryItem extends Record<string, unknown> {
  id: string;
  name: string;
  category?: string;
  sku?: string;
  currentStock: number;
  minStock?: number;
  reorderLevel?: number;
  unit?: string;
  expiryDate?: string;
  status?: string;
}

const statCards = [
  { label: 'Total Items', icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-50', key: 'total' },
  { label: 'In Stock', icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50', key: 'inStock' },
  { label: 'Low Stock', icon: AlertTriangle, color: 'text-amber-600', bgColor: 'bg-amber-50', key: 'lowStock' },
  { label: 'Out of Stock', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50', key: 'outOfStock' },
];

function getStockStatus(item: InventoryItem): string {
  if (item.currentStock === 0) return 'out_of_stock';
  if (item.reorderLevel && item.currentStock <= item.reorderLevel) return 'low_stock';
  return 'in_stock';
}

function getExpiryStatus(expiryDate?: string): React.ReactNode {
  if (!expiryDate) return <span className="text-muted-foreground">-</span>;
  const expiry = new Date(expiryDate);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) return <StatusBadge status="expired" />;
  if (daysUntilExpiry <= 30) return <StatusBadge status="critical" />;
  if (daysUntilExpiry <= 90) return <StatusBadge status="warning" variant="warning" />;
  return <StatusBadge status="valid" variant="success" />;
}

const columns: Column<InventoryItem>[] = [
  {
    key: 'name',
    label: 'Item Name',
    sortable: true,
    render: (item) => (
      <div>
        <p className="font-medium text-foreground">{item.name}</p>
        {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
      </div>
    ),
  },
  { key: 'category', label: 'Category', sortable: true },
  {
    key: 'currentStock',
    label: 'Current Stock',
    sortable: true,
    render: (item) => (
      <span className="font-medium">
        {item.currentStock} {item.unit || 'units'}
      </span>
    ),
  },
  {
    key: 'reorderLevel',
    label: 'Reorder Level',
    render: (item) => (item.reorderLevel != null ? `${item.reorderLevel} ${item.unit || 'units'}` : '-'),
  },
  {
    key: 'stockStatus',
    label: 'Stock Status',
    render: (item) => <StatusBadge status={getStockStatus(item)} />,
  },
  {
    key: 'expiryDate',
    label: 'Expiry Status',
    render: (item) => getExpiryStatus(item.expiryDate as string | undefined),
  },
];

export default function OTStocksPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['ot', 'stocks', { page, search }],
    queryFn: async () => {
      const response = await apiGet<InventoryItem[]>('/inventory/items', {
        params: { page, limit: 20, search: search || undefined },
      });
      return { data: response.data, meta: response.meta };
    },
  });

  const { data: lowStockData } = useQuery({
    queryKey: ['ot', 'stocks', 'low-stock'],
    queryFn: async () => {
      const response = await apiGet<InventoryItem[]>('/inventory/items/low-stock');
      return response.data;
    },
  });

  const items = (data?.data ?? []) as InventoryItem[];
  const lowStockCount = lowStockData?.length ?? 0;
  const totalItems = data?.meta?.total ?? 0;
  const outOfStock = items.filter((i) => i.currentStock === 0).length;
  const inStock = totalItems - lowStockCount - outOfStock;

  const stats = { total: totalItems, inStock, lowStock: lowStockCount, outOfStock };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="OT Consumable Stocks"
        description="Monitor stock levels, reorder alerts, and expiry status for OT consumables"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.key}
            className={`bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4 border-primary ${card.bgColor} transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white/80 p-2">
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="font-headline text-3xl font-extrabold">{stats[card.key as keyof typeof stats]}</p>
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
          placeholder="Search items..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        total={data?.meta?.total ?? 0}
        onPageChange={setPage}
        emptyMessage="No stock items found."
      />
    </div>
  );
}
