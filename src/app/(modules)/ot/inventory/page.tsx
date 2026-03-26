'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@/lib/date-utils';
import {
  Package, Search, Plus, Pencil, Trash2, MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

interface InventoryItem extends Record<string, unknown> {
  id: string;
  name: string;
  category?: string;
  sku?: string;
  description?: string;
  currentStock: number;
  minStock?: number;
  reorderLevel?: number;
  unit?: string;
  unitPrice?: number;
  expiryDate?: string;
  supplier?: string;
  location?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export default function OTInventoryPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['ot', 'inventory', { page, search }],
    queryFn: async () => {
      const response = await apiGet<InventoryItem[]>('/inventory/items', {
        params: { page, limit: 20, search: search || undefined },
      });
      return { data: response.data, meta: response.meta };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/inventory/items/${id}`);
    },
    onSuccess: () => {
      toast.success('Item deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['ot', 'inventory'] });
    },
    onError: () => {
      toast.error('Failed to delete item');
    },
  });

  const items = (data?.data ?? []) as InventoryItem[];

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
      label: 'Stock',
      sortable: true,
      render: (item) => (
        <span className="font-medium">
          {item.currentStock} {item.unit || 'units'}
        </span>
      ),
    },
    {
      key: 'unitPrice',
      label: 'Unit Price',
      render: (item) =>
        item.unitPrice != null ? `Rs. ${Number(item.unitPrice).toLocaleString('en-IN')}` : '-',
    },
    {
      key: 'supplier',
      label: 'Supplier',
      render: (item) => item.supplier || '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => {
        if (item.currentStock === 0) return <StatusBadge status="out_of_stock" />;
        if (item.reorderLevel && item.currentStock <= item.reorderLevel) return <StatusBadge status="low_stock" />;
        return <StatusBadge status="in_stock" />;
      },
    },
    {
      key: 'createdAt',
      label: 'Added On',
      render: (item) => formatDate(item.createdAt as string),
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'text-center w-[100px]',
      render: (item) => (
        <div className="flex items-center justify-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-red-600"
            onClick={() => {
              if (confirm('Are you sure you want to delete this item?')) {
                deleteMutation.mutate(item.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="OT Inventory Management"
        description="Manage OT equipment, surgical instruments, and consumables"
        action={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search items by name, category, SKU..."
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
        emptyMessage="No inventory items found. Click 'Add Item' to add your first item."
      />
    </div>
  );
}
