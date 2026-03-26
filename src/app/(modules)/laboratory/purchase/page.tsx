'use client';

import { useState } from 'react';
import { Search, Plus, ShoppingCart, RefreshCw, CheckCircle, Truck, Clock, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  usePurchaseOrders,
  useCreatePurchaseOrder,
  useApprovePurchaseOrder,
  useReceivePurchaseOrder,
  useSuppliers,
  useInventoryItems,
} from '@/hooks/use-lab';
import type { PurchaseOrder } from '@/hooks/use-lab';

const statusConfig: Record<string, { label: string; className: string; icon?: typeof Clock }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-800', icon: Clock },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800', icon: Clock },
  approved: { label: 'Approved', className: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  ordered: { label: 'Ordered', className: 'bg-purple-100 text-purple-800', icon: Truck },
  received: { label: 'Received', className: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function LabPurchasePage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, refetch } = usePurchaseOrders({
    search: search || undefined,
    page,
    limit: 20,
    status: statusFilter || undefined,
  });

  const approvePO = useApprovePurchaseOrder();
  const receivePO = useReceivePurchaseOrder();

  const orders = data?.data ?? [];
  const meta = data?.meta;

  const handleApprove = async (id: string) => {
    try {
      await approvePO.mutateAsync(id);
      toast.success('Purchase order approved');
    } catch {
      toast.error('Failed to approve purchase order');
    }
  };

  const handleReceive = async (id: string) => {
    try {
      await receivePO.mutateAsync(id);
      toast.success('Purchase order marked as received');
    } catch {
      toast.error('Failed to mark as received');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">Purchase Orders</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="mr-1.5 h-4 w-4" />
              Create PO
            </DialogTrigger>
            <CreatePODialog onClose={() => setDialogOpen(false)} />
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search PO number, supplier..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {[
            { value: '', label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'ordered', label: 'Ordered' },
            { value: 'received', label: 'Received' },
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
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">PO #</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Supplier</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Items</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Total Amount</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Date</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <ShoppingCart className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No purchase orders found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((po: PurchaseOrder) => {
                  const status = statusConfig[po.status] || statusConfig.draft;
                  const StatusIcon = status.icon;
                  return (
                    <tr key={po.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3 font-medium font-mono text-xs">{po.poNumber}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{po.supplier?.name || '-'}</div>
                        {po.supplier?.phone && (
                          <div className="text-xs text-muted-foreground">{po.supplier.phone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[200px]">
                          {po.items?.length > 0 ? (
                            <div className="text-xs">
                              {po.items.slice(0, 2).map((item, i) => (
                                <div key={i} className="truncate">{item.itemName} x{item.quantity}</div>
                              ))}
                              {po.items.length > 2 && (
                                <span className="text-muted-foreground">+{po.items.length - 2} more</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {po.totalAmount?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full',
                          status.className,
                        )}>
                          {StatusIcon && <StatusIcon className="h-3 w-3" />}
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {po.createdAt ? new Date(po.createdAt).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {po.status === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApprove(po.id)}
                              disabled={approvePO.isPending}
                            >
                              Approve
                            </Button>
                          )}
                          {(po.status === 'approved' || po.status === 'ordered') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReceive(po.id)}
                              disabled={receivePO.isPending}
                            >
                              Mark Received
                            </Button>
                          )}
                        </div>
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
              Page {page} of {meta?.totalPages} ({meta?.total} orders)
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

interface POItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
}

function CreatePODialog({ onClose }: { onClose: () => void }) {
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<POItem[]>([{ itemId: '', itemName: '', quantity: 1, unitPrice: 0 }]);

  const createPO = useCreatePurchaseOrder();
  const { data: suppliersData } = useSuppliers();
  const { data: inventoryData } = useInventoryItems({ limit: 100 });
  const suppliers = suppliersData?.data ?? [];
  const inventoryItems = inventoryData?.data ?? [];

  const addItem = () => {
    setItems((prev) => [...prev, { itemId: '', itemName: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof POItem, value: string | number) => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== index) return item;
      if (field === 'itemId') {
        const found = inventoryItems.find((inv) => inv.id === value);
        return { ...item, itemId: value as string, itemName: found?.name || '', unitPrice: found?.unitPrice || 0 };
      }
      return { ...item, [field]: value };
    }));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast.error('Please select a supplier');
      return;
    }
    const validItems = items.filter((item) => item.itemId && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    try {
      await createPO.mutateAsync({
        supplierId,
        items: validItems.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        expectedDeliveryDate: expectedDate || undefined,
        notes: notes || undefined,
      });
      toast.success('Purchase order created');
      onClose();
    } catch {
      toast.error('Failed to create purchase order');
    }
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Create Purchase Order</DialogTitle>
        <DialogDescription>Create a new purchase order for lab supplies.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="po-supplier">Supplier *</Label>
            <select
              id="po-supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="po-date">Expected Delivery</Label>
            <Input
              id="po-date"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>
        </div>

        {/* Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Items</Label>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-1 h-3 w-3" />
              Add Row
            </Button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <select
                    value={item.itemId}
                    onChange={(e) => updateItem(index, 'itemId', e.target.value)}
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="">Select item</option>
                    {inventoryItems.map((inv) => (
                      <option key={inv.id} value={inv.id}>{inv.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Price"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    disabled={items.length <= 1}
                    className="text-destructive"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="text-right text-sm font-medium">
            Total: {totalAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
          </div>
        </div>

        <div>
          <Label htmlFor="po-notes">Notes</Label>
          <Textarea
            id="po-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes..."
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={createPO.isPending}>
            {createPO.isPending ? 'Creating...' : 'Create PO'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
