'use client';

import { useState, useMemo } from 'react';
import { Boxes, Search, AlertTriangle, Package, CheckCircle2, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import {
  useInventoryItems, useLowStockItems, type InventoryCategory, type InventoryItem,
} from '@/hooks/use-inventory';

// OT teams care primarily about surgical supplies + consumables. The dropdown
// defaults to surgical_supply to cut noise; users can switch to "all" anytime.
const OT_CATEGORIES: Array<{ value: InventoryCategory | 'all'; label: string }> = [
  { value: 'surgical_supply', label: 'Surgical Supplies' },
  { value: 'consumable', label: 'Consumables' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'drug', label: 'Drugs' },
  { value: 'all', label: 'All categories' },
];

interface StockRow extends Record<string, unknown> {
  id: string;
  itemName: string;
  itemCode: string | null;
  category: string;
  currentStock: number;
  minimumStockThreshold: number;
  unitOfMeasurement: string | null;
}

const statCards = [
  { label: 'Total Items', icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-50', key: 'total' },
  { label: 'In Stock', icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50', key: 'inStock' },
  { label: 'Low Stock', icon: AlertTriangle, color: 'text-amber-600', bgColor: 'bg-amber-50', key: 'lowStock' },
  { label: 'Out of Stock', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50', key: 'outOfStock' },
] as const;

function rowStatus(item: StockRow) {
  if (item.currentStock === 0) return 'out_of_stock';
  if (item.minimumStockThreshold && item.currentStock <= item.minimumStockThreshold) return 'low_stock';
  return 'in_stock';
}

const columns: Column<StockRow>[] = [
  {
    key: 'itemName',
    label: 'Item',
    sortable: true,
    render: (item) => (
      <div>
        <p className="font-medium text-foreground">{item.itemName}</p>
        {item.itemCode && <p className="text-xs text-muted-foreground">{item.itemCode}</p>}
      </div>
    ),
  },
  {
    key: 'category',
    label: 'Category',
    sortable: true,
    render: (item) => <span className="capitalize text-muted-foreground">{item.category.replace('_', ' ')}</span>,
  },
  {
    key: 'currentStock',
    label: 'Current Stock',
    sortable: true,
    render: (item) => (
      <span className="font-medium">{item.currentStock} {item.unitOfMeasurement ?? 'units'}</span>
    ),
  },
  {
    key: 'minimumStockThreshold',
    label: 'Reorder At',
    render: (item) => `${item.minimumStockThreshold ?? '-'} ${item.unitOfMeasurement ?? ''}`,
  },
  {
    key: 'stockStatus',
    label: 'Status',
    render: (item) => <StatusBadge status={rowStatus(item)} />,
  },
];

export default function OTStocksPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<InventoryCategory | 'all'>('surgical_supply');

  const { data, isLoading } = useInventoryItems({
    page,
    limit: 20,
    search: search.trim() || undefined,
    category: category === 'all' ? undefined : category,
    isActive: true,
  });
  const items = (data?.data ?? []) as unknown as StockRow[];

  const { data: lowStockData } = useLowStockItems({ limit: 500 });
  const lowStockCount = useMemo(() => {
    const rows = (lowStockData?.data ?? []) as unknown as StockRow[];
    if (category === 'all') return rows.length;
    return rows.filter((r) => r.category === category).length;
  }, [lowStockData, category]);

  const totalItems = data?.meta?.total ?? 0;
  const outOfStock = items.filter((i) => i.currentStock === 0).length;
  const stats: Record<string, number> = {
    total: totalItems,
    inStock: Math.max(0, totalItems - lowStockCount - outOfStock),
    lowStock: lowStockCount,
    outOfStock,
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader
        title="OT Consumable Stocks"
        description="Live view of surgical supplies, consumables and equipment with reorder + expiry alerts"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((card) => (
          <div key={card.key} className={`rounded-xl shadow-sanctuary p-4 ${card.bgColor}`}>
            <div className="flex items-center gap-2">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
            <p className="font-headline text-2xl font-extrabold mt-1">{stats[card.key].toLocaleString('en-IN')}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by item name or code..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={(v) => { setCategory((v ?? 'all') as InventoryCategory | 'all'); setPage(1); }}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OT_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        total={data?.meta?.total ?? 0}
        onPageChange={setPage}
        emptyMessage={`No ${category === 'all' ? '' : category.replace('_', ' ') + ' '}items found.`}
      />

      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Boxes className="h-3.5 w-3.5" /> To request more stock from pharmacy/warehouse, use OT → Stock Transfer.
      </div>
    </div>
  );
}
