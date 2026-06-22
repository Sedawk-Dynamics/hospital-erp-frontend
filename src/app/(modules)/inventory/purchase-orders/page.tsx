'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShoppingCart, Plus, CheckCircle2, PackageCheck, X, Ban,
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
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import {
  usePurchaseOrders, useCreatePurchaseOrder, useApprovePurchaseOrder,
  useReceivePurchaseOrder, useCancelPurchaseOrder, usePurchaseOrder, useInventoryItems, useSuppliers,
  type PurchaseOrderStatus, type CreatePurchaseOrderInput, type ReceivePurchaseOrderLine,
} from '@/hooks/use-inventory';
import { useFormulary } from '@/hooks/use-pharmacy';

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
      setSeedItems([{ kind: 'item', refId: id, itemName: name, quantityOrdered: qty }]);
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
  // A line is either a generic inventory item or a pharmacy drug.
  kind: 'item' | 'drug';
  refId: string; // inventoryItemId or drugId
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
  // Our own drugs (formulary) — so drugs can be purchased from a vendor too.
  const { data: drugsResp } = useFormulary({ search: search || undefined, limit: 15, isActive: true });
  const { data: suppliersResp } = useSuppliers({ limit: 100, isActive: true });
  const suppliers = suppliersResp?.data ?? [];
  const drugs = drugsResp?.data ?? [];
  const create = useCreatePurchaseOrder();

  const addLine = (kind: 'item' | 'drug', refId: string, itemName: string) => {
    if (items.some((i) => i.kind === kind && i.refId === refId)) {
      toast.error('Already added');
      return;
    }
    setItems([...items, { kind, refId, itemName, quantityOrdered: 1 }]);
  };

  const handleSubmit = async () => {
    if (!supplierId) { toast.error('Pick a supplier'); return; }
    if (items.length === 0) { toast.error('Add at least one line'); return; }
    const data: CreatePurchaseOrderInput = {
      supplierId,
      expectedDeliveryDate: expectedDate || undefined,
      notes: notes || undefined,
      items: items.map(({ kind, refId, quantityOrdered, unitPrice }) => ({
        inventoryItemId: kind === 'item' ? refId : undefined,
        drugId: kind === 'drug' ? refId : undefined,
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
                <SelectTrigger>
                  {/* Base UI renders the raw value by default — map it back to the name. */}
                  <SelectValue placeholder="Select supplier">
                    {(value) => suppliers.find((s) => s.id === value)?.name ?? 'Select supplier'}
                  </SelectValue>
                </SelectTrigger>
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
            <label className="text-xs font-medium">Add items / drugs</label>
            <Input placeholder="Search inventory items or our drugs..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && ((itemsResp?.data?.length ?? 0) > 0 || drugs.length > 0) && (
              <div className="max-h-48 overflow-y-auto rounded-md border mt-1 divide-y">
                {(itemsResp?.data?.length ?? 0) > 0 && (
                  <div>
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Inventory items</p>
                    {itemsResp!.data.map((it) => (
                      <button
                        key={`item-${it.id}`}
                        onClick={() => addLine('item', it.id, it.itemName)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <Badge variant="outline" className="text-[10px]">Item</Badge>
                        <span className="font-medium">{it.itemName}</span>
                        {it.itemCode && <span className="text-xs text-muted-foreground">{it.itemCode}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {drugs.length > 0 && (
                  <div>
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Our drugs (formulary)</p>
                    {drugs.map((d) => (
                      <button
                        key={`drug-${d.id}`}
                        onClick={() => addLine('drug', d.id, `${d.drugName}${d.strength ? ` ${d.strength}` : ''}`)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <Badge className="bg-teal-500/10 text-teal-700 border-teal-500/20 text-[10px]">Drug</Badge>
                        <span className="font-medium">{d.drugName}</span>
                        {d.strength && <span className="text-xs text-muted-foreground">{d.strength}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line</TableHead>
                    <TableHead className="w-24">Qty</TableHead>
                    <TableHead className="w-28">Unit ₹</TableHead>
                    <TableHead className="w-24 text-right">Total</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => (
                    <TableRow key={`${it.kind}-${it.refId}`}>
                      <TableCell className="text-sm">
                        <span className="font-medium">{it.itemName}</span>
                        <Badge
                          variant="outline"
                          className={cn('ml-2 text-[10px]', it.kind === 'drug' && 'bg-teal-500/10 text-teal-700 border-teal-500/20')}
                        >
                          {it.kind === 'drug' ? 'Drug' : 'Item'}
                        </Badge>
                      </TableCell>
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
  const cancel = useCancelPurchaseOrder();
  const [recvMap, setRecvMap] = useState<Record<string, number>>({});
  // Per-drug-line batch details captured at receipt (creates a real DrugBatch).
  const [recvBatch, setRecvBatch] = useState<Record<string, { batchNumber: string; expiryDate: string; storageLocation: string }>>({});
  const setBatch = (poItemId: string, patch: Partial<{ batchNumber: string; expiryDate: string; storageLocation: string }>) =>
    setRecvBatch((prev) => {
      const cur = prev[poItemId] ?? { batchNumber: '', expiryDate: '', storageLocation: '' };
      return { ...prev, [poItemId]: { ...cur, ...patch } };
    });

  const handleApprove = async () => {
    if (!confirm('Approve this PO?')) return;
    try {
      await approve.mutateAsync(id);
      toast.success('PO approved');
    } catch (err) { toast.error((err as Error).message); }
  };

  const handleCancel = async () => {
    const reason = window.prompt('Cancel this PO? Optionally enter a reason:');
    if (reason === null) return; // user dismissed the prompt
    try {
      await cancel.mutateAsync({ id, reason: reason || undefined });
      toast.success('PO cancelled');
      onClose();
    } catch (err) { toast.error((err as Error).message); }
  };

  const canCancel = data && ['draft', 'submitted', 'approved'].includes(data.status);

  const handleReceive = async () => {
    if (!data) return;
    const lines: ReceivePurchaseOrderLine[] = [];
    for (const i of data.items ?? []) {
      const qty = recvMap[i.id] ?? 0;
      if (qty <= 0) continue;
      if (i.drugId) {
        // Drug lines land as a real DrugBatch — batch + expiry are required.
        const b = recvBatch[i.id];
        if (!b?.batchNumber?.trim() || !b?.expiryDate) {
          toast.error(`Enter batch number & expiry for "${i.drug?.drugName ?? 'drug'}"`);
          return;
        }
        lines.push({
          purchaseOrderItemId: i.id,
          quantityReceived: qty,
          batchNumber: b.batchNumber.trim(),
          expiryDate: b.expiryDate,
          storageLocation: b.storageLocation?.trim() || undefined,
        });
      } else {
        lines.push({ purchaseOrderItemId: i.id, quantityReceived: qty });
      }
    }
    if (lines.length === 0) { toast.error('Enter received qty'); return; }
    try {
      await receive.mutateAsync({ id, items: lines });
      toast.success('Items received & stock updated');
      setRecvMap({});
      setRecvBatch({});
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
                  const isDrug = !!it.drugId;
                  const name = isDrug
                    ? `${it.drug?.drugName ?? 'Drug'}${it.drug?.strength ? ` ${it.drug.strength}` : ''}`
                    : it.inventoryItem?.itemName ?? '-';
                  const receiving = data.status === 'approved' || data.status === 'partially_delivered';
                  return (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium align-top">
                        {name}
                        <Badge
                          variant="outline"
                          className={cn('ml-2 text-[10px]', isDrug && 'bg-teal-500/10 text-teal-700 border-teal-500/20')}
                        >
                          {isDrug ? 'Drug' : 'Item'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right align-top">{it.quantityOrdered}</TableCell>
                      <TableCell className="text-right align-top">{it.quantityReceived}</TableCell>
                      <TableCell className="text-right align-top">
                        {it.unitPrice ? `₹${Number(it.unitPrice).toFixed(2)}` : '-'}
                      </TableCell>
                      {receiving && (
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
                          {/* Drug lines receive into a real DrugBatch → need batch + expiry. */}
                          {isDrug && (recvMap[it.id] ?? 0) > 0 && (
                            <div className="mt-1.5 flex flex-col items-end gap-1">
                              <Input
                                value={recvBatch[it.id]?.batchNumber ?? ''}
                                onChange={(e) => setBatch(it.id, { batchNumber: e.target.value })}
                                placeholder="Batch no. *"
                                className="h-7 w-32 text-xs"
                              />
                              <Input
                                type="date"
                                value={recvBatch[it.id]?.expiryDate ?? ''}
                                onChange={(e) => setBatch(it.id, { expiryDate: e.target.value })}
                                title="Expiry *"
                                className="h-7 w-32 text-xs"
                              />
                              <Input
                                value={recvBatch[it.id]?.storageLocation ?? ''}
                                onChange={(e) => setBatch(it.id, { storageLocation: e.target.value })}
                                placeholder="Storage (rack)"
                                className="h-7 w-32 text-xs"
                              />
                            </div>
                          )}
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
          {canCancel && (
            <Button
              variant="outline"
              className="mr-auto text-red-600 hover:text-red-700"
              onClick={handleCancel}
              disabled={cancel.isPending}
            >
              <Ban className="mr-1.5 h-4 w-4" /> Cancel PO
            </Button>
          )}
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
