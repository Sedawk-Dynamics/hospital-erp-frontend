'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';

interface InventoryItem {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  description?: string;
  currentStock: number;
  reorderLevel: number;
  unit: string;
  unitCost: number;
  supplierId?: string;
  supplier?: { name: string };
  expiryDate?: string;
  location?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function getStockStatus(currentStock: number, reorderLevel: number): string {
  if (currentStock <= 0) return 'out_of_stock';
  if (currentStock <= reorderLevel) return 'low_stock';
  return 'in_stock';
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

// Map backend fields to the local InventoryItem shape
function mapApiItem(raw: Record<string, unknown>): InventoryItem {
  return {
    id: raw.id as string,
    name: (raw.itemName as string) ?? '',
    sku: (raw.itemCode as string) ?? undefined,
    category: (raw.category as string) ?? undefined,
    description: (raw.description as string) ?? undefined,
    currentStock: (raw.currentStock as number) ?? 0,
    reorderLevel: (raw.minimumStockThreshold as number) ?? 0,
    unit: (raw.unitOfMeasurement as string) ?? 'each',
    unitCost: (raw.costPerUnit as number) ?? 0,
    supplierId: (raw.supplierId as string) ?? undefined,
    supplier: raw.supplier as { name: string } | undefined,
    expiryDate: (raw.expiryDate as string) ?? undefined,
    location: (raw.location as string) ?? undefined,
    isActive: (raw.isActive as boolean) ?? true,
    createdAt: (raw.createdAt as string) ?? '',
    updatedAt: (raw.updatedAt as string) ?? '',
  };
}

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/inventory/items', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
        },
      });
      const rawItems = data.data || [];
      setItems(rawItems.map((item: Record<string, unknown>) => mapApiItem(item)));
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch inventory items');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, categoryFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const columns: Column<InventoryItem>[] = [
    {
      key: 'name',
      label: 'Item Name',
      sortable: true,
      render: (item) => (
        <span className="font-medium">{item.name}</span>
      ),
    },
    {
      key: 'sku',
      label: 'SKU/Code',
      render: (item) =>
        item.sku ? (
          <Badge variant="outline" className="font-mono">
            {item.sku}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (item) => (
        <span className="capitalize">
          {item.category?.replace(/_/g, ' ') ?? '-'}
        </span>
      ),
    },
    {
      key: 'currentStock',
      label: 'Current Stock',
      sortable: true,
      render: (item) => (
        <span
          className={
            item.currentStock <= 0
              ? 'text-red-600 font-semibold dark:text-red-400'
              : item.currentStock <= item.reorderLevel
                ? 'text-red-600 font-semibold dark:text-red-400'
                : ''
          }
        >
          {item.currentStock}
        </span>
      ),
    },
    {
      key: 'reorderLevel',
      label: 'Reorder Level',
      render: (item) => <span>{item.reorderLevel}</span>,
    },
    {
      key: 'unit',
      label: 'Unit',
      render: (item) => (
        <span className="capitalize">{item.unit}</span>
      ),
    },
    {
      key: 'unitCost',
      label: 'Unit Cost',
      render: (item) => formatCurrency(item.unitCost),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => (
        <StatusBadge status={getStockStatus(item.currentStock, item.reorderLevel)} />
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (item) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/inventory/${item.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Manage hospital supplies and inventory"
        action={
          <Button onClick={() => router.push('/inventory/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val ?? 'all'); setPage(1); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="drug">Drug</SelectItem>
              <SelectItem value="consumable">Consumable</SelectItem>
              <SelectItem value="surgical_supply">Surgical Supply</SelectItem>
              <SelectItem value="equipment">Equipment</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns as any}
        data={items as any}
        searchPlaceholder="Search inventory items..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No inventory items found."
      />
    </div>
  );
}
