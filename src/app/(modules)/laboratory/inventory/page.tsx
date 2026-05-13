'use client';

import { useState } from 'react';
import { Search, Plus, Package, AlertTriangle, PackageX, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useInventoryItems, useCreateInventoryItem, useSuppliers } from '@/hooks/use-lab';
import type { InventoryItem } from '@/hooks/use-lab';
import { SupervisorOnlyGuard } from '@/components/laboratory/supervisor-only-guard';

const statusConfig: Record<string, { label: string; className: string }> = {
  in_stock: { label: 'In Stock', className: 'bg-green-100 text-green-800' },
  low_stock: { label: 'Low Stock', className: 'bg-amber-100 text-amber-800' },
  out_of_stock: { label: 'Out of Stock', className: 'bg-red-100 text-red-800' },
};

export default function LabInventoryPage() {
  return (
    <SupervisorOnlyGuard>
      <LabInventoryPageInner />
    </SupervisorOnlyGuard>
  );
}

function LabInventoryPageInner() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useInventoryItems({
    search: search || undefined,
    page,
    limit: 20,
    status: statusFilter || undefined,
  });

  const items = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">Lab Inventory</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Item
            </DialogTrigger>
            <CreateItemDialog onClose={() => setDialogOpen(false)} />
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1">
          {[
            { value: '', label: 'All' },
            { value: 'in_stock', label: 'In Stock' },
            { value: 'low_stock', label: 'Low Stock' },
            { value: 'out_of_stock', label: 'Out of Stock' },
          ].map((filter) => (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter(filter.value); setPage(1); }}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Item Name</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Category</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">SKU</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Current Stock</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Reorder Level</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Supplier</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No inventory items found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item: InventoryItem) => {
                  const status = statusConfig[item.status] || statusConfig.in_stock;
                  return (
                    <tr key={item.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.name}</div>
                        {item.unit && <div className="text-xs text-muted-foreground">Unit: {item.unit}</div>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.category || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{item.sku || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          'font-medium',
                          item.currentStock <= item.reorderLevel && 'text-red-600',
                        )}>
                          {item.currentStock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{item.reorderLevel}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.supplier?.name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full',
                          status.className,
                        )}>
                          {item.status === 'low_stock' && <AlertTriangle className="h-3 w-3" />}
                          {item.status === 'out_of_stock' && <PackageX className="h-3 w-3" />}
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {(meta?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {page} of {meta?.totalPages} ({meta?.total} items)
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= (meta?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateItemDialog({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    sku: '',
    currentStock: 0,
    reorderLevel: 10,
    unit: '',
    unitPrice: 0,
    supplierId: '',
  });

  const createItem = useCreateInventoryItem();
  const { data: suppliersData } = useSuppliers();
  const suppliers = suppliersData?.data ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Item name is required');
      return;
    }
    try {
      await createItem.mutateAsync({
        name: formData.name,
        category: formData.category || undefined,
        sku: formData.sku || undefined,
        currentStock: formData.currentStock,
        reorderLevel: formData.reorderLevel,
        unit: formData.unit || undefined,
        unitPrice: formData.unitPrice || undefined,
        supplierId: formData.supplierId || undefined,
      });
      toast.success('Inventory item created');
      onClose();
    } catch {
      toast.error('Failed to create inventory item');
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Add Inventory Item</DialogTitle>
        <DialogDescription>Add a new lab supply or reagent to inventory.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="item-name">Item Name *</Label>
            <Input
              id="item-name"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Blood Collection Tubes"
            />
          </div>
          <div>
            <Label htmlFor="item-category">Category</Label>
            <Input
              id="item-category"
              value={formData.category}
              onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
              placeholder="e.g. Reagents"
            />
          </div>
          <div>
            <Label htmlFor="item-sku">SKU</Label>
            <Input
              id="item-sku"
              value={formData.sku}
              onChange={(e) => setFormData((p) => ({ ...p, sku: e.target.value }))}
              placeholder="e.g. BCT-001"
            />
          </div>
          <div>
            <Label htmlFor="item-stock">Current Stock</Label>
            <Input
              id="item-stock"
              type="number"
              value={formData.currentStock}
              onChange={(e) => setFormData((p) => ({ ...p, currentStock: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <Label htmlFor="item-reorder">Reorder Level</Label>
            <Input
              id="item-reorder"
              type="number"
              value={formData.reorderLevel}
              onChange={(e) => setFormData((p) => ({ ...p, reorderLevel: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <Label htmlFor="item-unit">Unit</Label>
            <Input
              id="item-unit"
              value={formData.unit}
              onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))}
              placeholder="e.g. pcs, ml, box"
            />
          </div>
          <div>
            <Label htmlFor="item-price">Unit Price</Label>
            <Input
              id="item-price"
              type="number"
              step="0.01"
              value={formData.unitPrice}
              onChange={(e) => setFormData((p) => ({ ...p, unitPrice: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="item-supplier">Supplier</Label>
            <select
              id="item-supplier"
              value={formData.supplierId}
              onChange={(e) => setFormData((p) => ({ ...p, supplierId: e.target.value }))}
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={createItem.isPending}>
            {createItem.isPending ? 'Creating...' : 'Add Item'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
