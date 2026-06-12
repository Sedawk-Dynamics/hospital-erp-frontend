'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShoppingCart, Plus, CheckCircle2, PackageCheck, X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import {
  usePurchaseOrders, useCreatePurchaseOrder, useApprovePurchaseOrder,
  useReceivePurchaseOrder, usePurchaseOrder, useInventoryItems, useSuppliers,
  type PurchaseOrderStatus, type CreatePurchaseOrderInput,
} from '@/hooks/use-inventory';

type Tab = 'all' | 'draft' | 'approved' | 'delivered';

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [seedItems, setSeedItems] = useState<PoLineSeed[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);

  // A low-stock "Reorder" deep-link (?reorderItemId=&reorderItemName=&reorderQty=)
  // auto-opens the create dialog pre-seeded with that item.
  useEffect(() => {
    const id = searchParams.get('reorderItemId');
    const name = searchParams.get('reorderItemName');
    if (id && name) {
      const qty = Math.max(1, Number(searchParams.get('reorderQty')) || 1);
      setSeedItems([{ inventoryItemId: id, itemName: name, quantityOrdered: qty }]);
      setCreateOpen(true);
      // Drop the params so a later "New PO" opens blank.
      router.replace('/inventory/purchase-orders');
    }
  }, [searchParams, router]);

  const { data, isLoading } = usePurchaseOrders({
    status: tab === 'all' ? undefined : (tab as PurchaseOrderStatus),
    limit: 50,
  });
  const orders = data?.data ?? [];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Purchase Orders
          </h1>
          <p className="text-xs text-muted-foreground">
            Raise POs to suppliers. On receipt, stock is auto-incremented.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New PO
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="delivered">Delivered</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-3">
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : orders.length === 0 ? (
              <EmptyState icon={ShoppingCart} title="No POs" description="Create a purchase order." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((po) => {
                    const statusCls = {
                      draft: 'bg-slate-500/10 text-slate-700 border-slate-500/20',
                      submitted: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
                      approved: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
                      partially_delivered: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
                      delivered: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
                      cancelled: 'bg-red-500/10 text-red-700 border-red-500/20',
                    }[po.status];
                    return (
                      <TableRow key={po.id}>
                        <TableCell className="font-mono text-xs">{po.orderNumber}</TableCell>
                        <TableCell className="font-medium">{po.supplier?.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(po.orderDate)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : '-'}
                        </TableCell>
                        <TableCell className="text-right">{po._count?.items ?? po.items?.length ?? 0}</TableCell>
                        <TableCell className="text-right">
                          {po.totalAmount ? `₹${Number(po.totalAmount).toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={statusCls}>{po.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => setDetailId(po.id)}>View</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {createOpen && (
        <CreatePoDialog
          initialItems={seedItems}
          onClose={() => { setCreateOpen(false); setSeedItems([]); }}
        />
      )}
      {detailId && <PoDetailDialog id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

interface PoLineSeed {
  inventoryItemId: string;
  itemName: string;
  quantityOrdered: number;
  unitPrice?: number;
}

function CreatePoDialog({ onClose, initialItems }: { onClose: () => void; initialItems?: PoLineSeed[] }) {
  const [supplierId, setSupplierId] = useState<string>('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  // Seeded from a low-stock "Reorder" deep-link when present.
  const [items, setItems] = useState<PoLineSeed[]>(initialItems ?? []);

  const { data: itemsResp } = useInventoryItems({ search: search || undefined, limit: 20, isActive: true });
  const { data: suppliersResp } = useSuppliers({ limit: 100, isActive: true });
  const suppliers = suppliersResp?.data ?? [];
  const create = useCreatePurchaseOrder();

  const addItem = (itemId: string, itemName: string) => {
    if (items.some((i) => i.inventoryItemId === itemId)) {
      toast.error('Item already added');
      return;
    }
    setItems([...items, { inventoryItemId: itemId, itemName, quantityOrdered: 1 }]);
  };

  const handleSubmit = async () => {
    if (!supplierId) { toast.error('Pick a supplier'); return; }
    if (items.length === 0) { toast.error('Add at least one item'); return; }
    const data: CreatePurchaseOrderInput = {
      supplierId,
      expectedDeliveryDate: expectedDate || undefined,
      notes: notes || undefined,
      items: items.map(({ inventoryItemId, quantityOrdered, unitPrice }) => ({
        inventoryItemId,
        quantityOrdered,
        unitPrice,
      })),
    };
    try {
      await create.mutateAsync(data);
      toast.success('PO created');
      onClose();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed');
    }
  };

  const total = items.reduce((s, i) => s + (i.unitPrice ?? 0) * i.quantityOrdered, 0);

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Supplier *</label>
              <Select value={supplierId || null} onValueChange={(v) => setSupplierId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Expected delivery</label>
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Add items</label>
            <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {itemsResp && itemsResp.data.length > 0 && search && (
              <div className="max-h-32 overflow-y-auto rounded-md border mt-1">
                {itemsResp.data.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => addItem(it.id, it.itemName)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="font-medium">{it.itemName}</span>
                    {it.itemCode && <span className="text-xs text-muted-foreground ml-2">{it.itemCode}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-24">Qty</TableHead>
                    <TableHead className="w-28">Unit ₹</TableHead>
                    <TableHead className="w-24 text-right">Total</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => (
                    <TableRow key={it.inventoryItemId}>
                      <TableCell className="font-medium text-sm">{it.itemName}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={it.quantityOrdered}
                          onChange={(e) => {
                            const v = Math.max(1, Number(e.target.value) || 1);
                            setItems(items.map((x, i) => i === idx ? { ...x, quantityOrdered: v } : x));
                          }}
                          className="h-8 w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={it.unitPrice ?? ''}
                          onChange={(e) => {
                            const v = e.target.value ? Number(e.target.value) : undefined;
                            setItems(items.map((x, i) => i === idx ? { ...x, unitPrice: v } : x));
                          }}
                          className="h-8 w-24"
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        ₹{((it.unitPrice ?? 0) * it.quantityOrdered).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="px-4 py-2 border-t flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="font-bold">₹{total.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>Create PO</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PoDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = usePurchaseOrder(id);
  const approve = useApprovePurchaseOrder();
  const receive = useReceivePurchaseOrder();
  const [recvMap, setRecvMap] = useState<Record<string, number>>({});

  const handleApprove = async () => {
    if (!confirm('Approve this PO?')) return;
    try {
      await approve.mutateAsync(id);
      toast.success('PO approved');
    } catch (err) { toast.error((err as Error).message); }
  };

  const handleReceive = async () => {
    if (!data) return;
    const items = data.items?.filter((i) => (recvMap[i.id] ?? 0) > 0)
      .map((i) => ({ purchaseOrderItemId: i.id, quantityReceived: recvMap[i.id] })) ?? [];
    if (items.length === 0) { toast.error('Enter received qty'); return; }
    try {
      await receive.mutateAsync({ id, items });
      toast.success('Items received & stock updated');
      setRecvMap({});
    } catch (err) { toast.error((err as Error).message); }
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PO Details</DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><b>Order:</b> <span className="font-mono">{data.orderNumber}</span></div>
              <div><b>Supplier:</b> {data.supplier?.name}</div>
              <div><b>Status:</b> {data.status}</div>
              <div><b>Order Date:</b> {formatDate(data.orderDate)}</div>
              <div><b>Expected:</b> {data.expectedDeliveryDate ? formatDate(data.expectedDeliveryDate) : '-'}</div>
              <div><b>Total:</b> {data.totalAmount ? `₹${Number(data.totalAmount).toFixed(2)}` : '-'}</div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Unit ₹</TableHead>
                  {data.status === 'approved' || data.status === 'partially_delivered' ? (
                    <TableHead className="text-right">Receive Now</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items?.map((it) => {
                  const pending = it.quantityOrdered - it.quantityReceived;
                  return (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium">{it.inventoryItem?.itemName}</TableCell>
                      <TableCell className="text-right">{it.quantityOrdered}</TableCell>
                      <TableCell className="text-right">{it.quantityReceived}</TableCell>
                      <TableCell className="text-right">
                        {it.unitPrice ? `₹${Number(it.unitPrice).toFixed(2)}` : '-'}
                      </TableCell>
                      {(data.status === 'approved' || data.status === 'partially_delivered') && (
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            max={pending}
                            value={recvMap[it.id] ?? ''}
                            placeholder={String(pending)}
                            onChange={(e) => {
                              const v = Math.max(0, Math.min(pending, Number(e.target.value) || 0));
                              setRecvMap({ ...recvMap, [it.id]: v });
                            }}
                            className="h-8 w-20 ml-auto"
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {data.notes && (
              <div className="bg-muted/40 rounded-md p-2 text-sm">
                <b>Notes:</b> {data.notes}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          {data?.status === 'draft' && (
            <Button onClick={handleApprove} disabled={approve.isPending}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
            </Button>
          )}
          {(data?.status === 'approved' || data?.status === 'partially_delivered') && (
            <Button onClick={handleReceive} disabled={receive.isPending}>
              <PackageCheck className="mr-1.5 h-4 w-4" /> Receive Stock
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
