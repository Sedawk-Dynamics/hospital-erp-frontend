'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/date-utils';
import { Search, Plus, ShoppingCart, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import {
  usePurchaseOrders,
  useCreatePurchaseOrder,
  useApprovePurchaseOrder,
  useReceivePurchaseOrder,
  useSuppliers,
} from '@/hooks/use-inventory';
import { Textarea } from '@/components/ui/textarea';

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  approved: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  received: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
};

interface LineItem {
  itemName: string;
  quantity: string;
  unitPrice: string;
}

export default function PharmacyPurchasePage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([{ itemName: '', quantity: '', unitPrice: '' }]);

  const { data, isLoading } = usePurchaseOrders({ page, limit: 20, search: search || undefined });
  const { data: suppliersData } = useSuppliers();
  const createPO = useCreatePurchaseOrder();
  const approvePO = useApprovePurchaseOrder();
  const receivePO = useReceivePurchaseOrder();

  const orders = data?.data ?? [];
  const meta = data?.meta;
  const suppliers = suppliersData?.data ?? [];

  const addLineItem = () => {
    setLineItems([...lineItems, { itemName: '', quantity: '', unitPrice: '' }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const resetForm = () => {
    setSupplierId('');
    setNotes('');
    setLineItems([{ itemName: '', quantity: '', unitPrice: '' }]);
  };

  const handleCreate = async () => {
    const validItems = lineItems.filter((li) => li.itemName.trim() && li.quantity);
    if (validItems.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    try {
      await createPO.mutateAsync({
        supplierId: supplierId || undefined,
        notes: notes || undefined,
        items: validItems.map((li) => ({
          itemName: li.itemName,
          quantity: parseInt(li.quantity) || 1,
          unitPrice: li.unitPrice ? parseFloat(li.unitPrice) : undefined,
        })),
      });
      toast.success('Purchase order created');
      setDialogOpen(false);
      resetForm();
    } catch {
      toast.error('Failed to create purchase order');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approvePO.mutateAsync(id);
      toast.success('Purchase order approved');
    } catch {
      toast.error('Failed to approve order');
    }
  };

  const handleReceive = async (id: string) => {
    try {
      await receivePO.mutateAsync({ id });
      toast.success('Purchase order marked as received');
    } catch {
      toast.error('Failed to mark as received');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">Purchase Orders</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                Create PO
              </Button>
            }
          />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Purchase Order</DialogTitle>
              <DialogDescription>
                Add items and supplier details for the new purchase order.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <Label>Supplier</Label>
                <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add Item
                  </Button>
                </div>
                {lineItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_90px_32px] gap-2 items-end">
                    <div className="space-y-1">
                      {i === 0 && <span className="text-xs text-muted-foreground">Item Name</span>}
                      <Input
                        value={item.itemName}
                        onChange={(e) => updateLineItem(i, 'itemName', e.target.value)}
                        placeholder="Drug name"
                      />
                    </div>
                    <div className="space-y-1">
                      {i === 0 && <span className="text-xs text-muted-foreground">Qty</span>}
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(i, 'quantity', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      {i === 0 && <span className="text-xs text-muted-foreground">Unit Price</span>}
                      <Input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(i, 'unitPrice', e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLineItem(i)}
                      disabled={lineItems.length <= 1}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="po-notes">Notes</Label>
                <Textarea
                  id="po-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button onClick={handleCreate} disabled={createPO.isPending}>
                {createPO.isPending ? 'Creating...' : 'Create Order'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by PO number, supplier..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-muted/60" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No purchase orders"
            description={search ? 'No orders match your search.' : 'Create your first purchase order to start procurement.'}
            action={
              !search ? (
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create PO
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium font-mono">{order.poNumber}</TableCell>
                    <TableCell>{order.supplier?.name || '-'}</TableCell>
                    <TableCell className="text-center">{order.itemCount ?? order.items?.length ?? 0}</TableCell>
                    <TableCell className="text-right font-mono">
                      {order.totalAmount != null ? `₹${order.totalAmount.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={statusColors[order.status] || ''}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {order.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprove(order.id)}
                            disabled={approvePO.isPending}
                          >
                            Approve
                          </Button>
                        )}
                        {order.status === 'approved' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReceive(order.id)}
                            disabled={receivePO.isPending}
                          >
                            Receive
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, meta.total)} of {meta.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">{page} / {meta.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
