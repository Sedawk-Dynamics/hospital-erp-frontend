'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShoppingCart, Plus, PackageCheck, X, Ban, Truck, Phone, Search,
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
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import {
  usePurchaseOrders, useCreatePurchaseOrder,
  useReceivePurchaseOrder, useCancelPurchaseOrder, usePurchaseOrder, useInventoryItems, useSuppliers,
  type PurchaseOrderStatus, type CreatePurchaseOrderInput, type ReceivePurchaseOrderLine,
} from '@/hooks/use-inventory';
import { useFormulary } from '@/hooks/use-pharmacy';
import { StockTypeBadge } from '@/components/shared/stock-type-badge';

type Tab = 'all' | 'created' | 'delivered';

// Simplified lifecycle: a PO is Created (ready to receive) → Delivered. The
// older draft/submitted/approved states all read as "Created".
const STATUS_LABEL: Record<string, string> = {
  draft: 'Created',
  submitted: 'Created',
  approved: 'Created',
  partially_delivered: 'Partially delivered',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
const STATUS_CLS: Record<string, string> = {
  draft: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  submitted: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  approved: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  partially_delivered: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  delivered: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-700 border-red-500/20',
};
// Tab → the underlying status filter.
const TAB_STATUS: Record<Exclude<Tab, 'all'>, PurchaseOrderStatus> = {
  created: 'approved',
  delivered: 'delivered',
};

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
    status: tab === 'all' ? undefined : TAB_STATUS[tab],
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
          <TabsTrigger value="created">Created</TabsTrigger>
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
                    const statusCls = STATUS_CLS[po.status];
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
                          <Badge className={statusCls}>{STATUS_LABEL[po.status] ?? po.status}</Badge>
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
  // Composition (drug) / item code — shown under the name everywhere.
  subText?: string;
  quantityOrdered: number;
  // Estimated purchase price per unit — prefilled from the catalog price so the
  // PO carries a value up front; refined to the actual cost when stock arrives.
  unitPrice?: number;
}

/** ₹ with 2 decimals, Indian grouping. */
const inr = (n: number | string | null | undefined) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const invItems = itemsResp?.data ?? [];
  const drugs = drugsResp?.data ?? [];
  const create = useCreatePurchaseOrder();

  const supplier = suppliers.find((s) => s.id === supplierId);

  const addLine = (
    kind: 'item' | 'drug',
    refId: string,
    itemName: string,
    subText?: string,
    unitPrice?: number,
  ) => {
    if (items.some((i) => i.kind === kind && i.refId === refId)) {
      toast.error('Already added');
      return;
    }
    setItems((prev) => [...prev, { kind, refId, itemName, subText, quantityOrdered: 1, unitPrice }]);
    setSearch('');
  };

  const patchLine = (idx: number, patch: Partial<PoLineSeed>) =>
    setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  const totalQty = items.reduce((s, i) => s + (i.quantityOrdered || 0), 0);
  const estValue = items.reduce((s, i) => s + (i.quantityOrdered || 0) * (i.unitPrice || 0), 0);

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
        // Estimated unit price → backend computes the PO's total value up front.
        unitPrice: unitPrice && unitPrice > 0 ? unitPrice : undefined,
      })),
    };
    try {
      await create.mutateAsync(data);
      toast.success('Purchase order created');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to create purchase order'));
    }
  };

  const showResults = search.trim().length > 0;

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-[72rem] flex-col gap-0 overflow-hidden p-0 sm:max-w-[72rem]">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-14">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <ShoppingCart className="h-5 w-5 text-primary" /> New Purchase Order
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Order stock from a supplier. Add lines, set quantities and an expected rate — the actual
            purchase price is confirmed when the stock arrives.
          </p>
        </DialogHeader>

        {/* Two panes: order details on the left, line builder on the right. */}
        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,22rem)_1fr]">
          {/* LEFT — supplier / delivery / notes */}
          <div className="min-h-0 space-y-4 overflow-y-auto border-b px-6 py-5 lg:border-r lg:border-b-0">
            <SectionLabel icon={Truck} title="Supplier & delivery" />
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Supplier *</label>
              <Select value={supplierId || null} onValueChange={(v) => setSupplierId(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select supplier">
                    {(value) => suppliers.find((s) => s.id === value)?.name ?? 'Select supplier'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.supplyType && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({s.supplyType.replace(/_/g, ' ')})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vendor context once picked — GST / phone / credit term. */}
            {supplier && (
              <div className="space-y-1.5 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs">
                {supplier.phone && (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3 w-3" /> {supplier.phone}
                  </p>
                )}
                {supplier.gstNumber && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">GSTIN</span> · {supplier.gstNumber}
                  </p>
                )}
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Payment term</span> ·{' '}
                  {supplier.paymentTermDays != null ? `${supplier.paymentTermDays} days` : 'not set'}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Expected delivery</label>
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Delivery instructions, quotation ref, etc."
              />
            </div>
          </div>

          {/* RIGHT — item search + selected lines */}
          <div className="flex min-h-0 flex-col overflow-hidden bg-muted/10">
            <div className="shrink-0 space-y-2 border-b px-6 py-4">
              <SectionLabel icon={Search} title="Add items & drugs" />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or composition…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
                {showResults && (invItems.length > 0 || drugs.length > 0) && (
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover shadow-lg">
                    {invItems.length > 0 && (
                      <div>
                        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Inventory items</p>
                        {invItems.map((it) => (
                          <button
                            key={`item-${it.id}`}
                            onClick={() => addLine('item', it.id, it.itemName, it.itemCode ?? undefined, Number(it.costPerUnit) || undefined)}
                            className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            <Badge variant="outline" className="shrink-0 text-[10px]">Item</Badge>
                            <span className="truncate font-medium">{it.itemName}</span>
                            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                              {it.currentStock ?? 0} in stock
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {drugs.length > 0 && (
                      <div>
                        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Our stock (formulary)</p>
                        {drugs.map((d) => (
                          <button
                            key={`drug-${d.id}`}
                            onClick={() =>
                              addLine(
                                'drug',
                                d.id,
                                `${d.drugName}${d.strength ? ` ${d.strength}` : ''}`,
                                [d.genericName, d.manufacturer].filter(Boolean).join(' · ') || undefined,
                                Number(d.price) || undefined,
                              )
                            }
                            className="flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            <StockTypeBadge category={d.category} showMedicine className="mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate font-medium">{d.drugName}</span>
                                {d.strength && <span className="shrink-0 text-xs text-muted-foreground">{d.strength}</span>}
                              </div>
                              {(d.genericName || d.manufacturer) && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {[d.genericName, d.manufacturer].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {showResults && invItems.length === 0 && drugs.length === 0 && (
                <p className="text-xs text-muted-foreground">No items or drugs match &ldquo;{search}&rdquo;.</p>
              )}
            </div>

            {/* Selected line list */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed bg-background/50 p-8 text-center">
                  <ShoppingCart className="mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium">No lines yet</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Search above and pick items or drugs to add them to this order.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border bg-background">
                  <div className="grid grid-cols-[minmax(0,1fr)_5rem_7rem_6rem_2rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Line</span>
                    <span className="text-center">Qty</span>
                    <span className="text-right">Est. rate ₹</span>
                    <span className="text-right">Line total</span>
                    <span />
                  </div>
                  <div className="divide-y">
                    {items.map((it, idx) => (
                      <div
                        key={`${it.kind}-${it.refId}`}
                        className="grid grid-cols-[minmax(0,1fr)_5rem_7rem_6rem_2rem] items-center gap-2 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-sm font-medium">{it.itemName}</span>
                            <Badge
                              variant="outline"
                              className={cn('shrink-0 text-[10px]', it.kind === 'drug' && 'bg-teal-500/10 text-teal-700 border-teal-500/20')}
                            >
                              {it.kind === 'drug' ? 'Drug' : 'Item'}
                            </Badge>
                          </div>
                          {it.subText && <p className="truncate text-xs text-muted-foreground">{it.subText}</p>}
                        </div>
                        <Input
                          type="number"
                          min={1}
                          value={it.quantityOrdered}
                          onChange={(e) => patchLine(idx, { quantityOrdered: Math.max(1, Number(e.target.value) || 1) })}
                          className="h-8 w-full px-1 text-center text-sm"
                        />
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={it.unitPrice ?? ''}
                          placeholder="—"
                          onChange={(e) => patchLine(idx, { unitPrice: e.target.value ? Math.max(0, Number(e.target.value)) : undefined })}
                          className="h-8 w-full px-2 text-right text-sm"
                        />
                        <span className="text-right text-sm font-medium tabular-nums">
                          {it.unitPrice ? inr(it.quantityOrdered * it.unitPrice) : '—'}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky footer with the running estimate. */}
        <DialogFooter className="mx-0 mb-0 shrink-0 items-center gap-3 border-t px-6 py-4 sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span><b className="text-foreground">{items.length}</b> line{items.length === 1 ? '' : 's'}</span>
            <span><b className="text-foreground">{totalQty}</b> units</span>
            <span>
              Est. value <b className="text-foreground">{estValue > 0 ? inr(estValue) : '—'}</b>
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={create.isPending}>
              <ShoppingCart className="mr-1.5 h-4 w-4" />
              {create.isPending ? 'Creating…' : 'Create PO'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Small labelled divider used to group dialog sections. */
function SectionLabel({ icon: Icon, title }: { icon: typeof Truck; title: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <h3 className="font-label text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
    </div>
  );
}

function PoDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = usePurchaseOrder(id);
  const receive = useReceivePurchaseOrder();
  const cancel = useCancelPurchaseOrder();
  const [recvMap, setRecvMap] = useState<Record<string, number>>({});
  // Purchase price entered at arrival (PO creation no longer captures price).
  const [recvPrice, setRecvPrice] = useState<Record<string, number>>({});
  // Per-drug-line batch details captured at receipt (creates a real DrugBatch).
  const [recvBatch, setRecvBatch] = useState<Record<string, { batchNumber: string; expiryDate: string }>>({});
  const setBatch = (poItemId: string, patch: Partial<{ batchNumber: string; expiryDate: string }>) =>
    setRecvBatch((prev) => {
      const cur = prev[poItemId] ?? { batchNumber: '', expiryDate: '' };
      return { ...prev, [poItemId]: { ...cur, ...patch } };
    });

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
      const price = recvPrice[i.id];
      const unitPrice = price && price > 0 ? price : undefined;
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
          unitPrice,
          batchNumber: b.batchNumber.trim(),
          expiryDate: b.expiryDate,
        });
      } else {
        lines.push({ purchaseOrderItemId: i.id, quantityReceived: qty, unitPrice });
      }
    }
    if (lines.length === 0) { toast.error('Enter received qty'); return; }
    try {
      await receive.mutateAsync({ id, items: lines });
      toast.success('Items received & stock updated');
      setRecvMap({});
      setRecvPrice({});
      setRecvBatch({});
    } catch (err) { toast.error((err as Error).message); }
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex w-[96vw] max-w-none flex-col overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
            <PackageCheck className="h-5 w-5 text-primary" />
            Purchase Order
            {data && <span className="font-mono text-sm font-normal text-muted-foreground">{data.orderNumber}</span>}
            {data && <Badge className={cn('ml-1', STATUS_CLS[data.status])}>{STATUS_LABEL[data.status] ?? data.status}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="p-6"><Skeleton className="h-40 w-full" /></div>
        ) : (
          <div className="space-y-4 px-6 py-4">
            {/* Info card — supplier context, dates, and order value */}
            {(() => {
              const totalOrdered = data.items?.reduce((s, it) => s + it.quantityOrdered, 0) ?? 0;
              const totalReceived = data.items?.reduce((s, it) => s + it.quantityReceived, 0) ?? 0;
              const pct = totalOrdered ? Math.round((totalReceived / totalOrdered) * 100) : 0;
              // Ordered value = Σ qtyOrdered × unit price; received value = Σ line
              // totalPrice (set at receipt). Fall back to the PO's totalAmount.
              const orderedValue = data.items?.reduce(
                (s, it) => s + it.quantityOrdered * (Number(it.unitPrice) || 0), 0,
              ) ?? 0;
              const receivedValue = data.items?.reduce(
                (s, it) => s + (Number(it.totalPrice) || it.quantityReceived * (Number(it.unitPrice) || 0)), 0,
              ) ?? 0;
              const sup = data.supplier;
              const info: Array<[string, string]> = [
                ['Order Date', formatDate(data.orderDate)],
                ['Expected', data.expectedDeliveryDate ? formatDate(data.expectedDeliveryDate) : '—'],
                ['Ordered value', orderedValue > 0 ? inr(orderedValue) : '—'],
                ['Received value', receivedValue > 0 ? inr(receivedValue) : (data.totalAmount ? inr(data.totalAmount) : '—')],
              ];
              return (
                <div className="rounded-xl border bg-muted/20 p-4">
                  {/* Supplier line */}
                  <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-b pb-3">
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">{sup?.name ?? '—'}</span>
                    </div>
                    {sup?.phone && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {sup.phone}
                      </span>
                    )}
                    {sup?.gstNumber && (
                      <span className="text-xs text-muted-foreground">GSTIN · {sup.gstNumber}</span>
                    )}
                    {sup?.paymentTermDays != null && (
                      <span className="text-xs text-muted-foreground">Pay in {sup.paymentTermDays} days</span>
                    )}
                    {data.approver && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        Raised by {data.approver.firstName} {data.approver.lastName}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {info.map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</p>
                        <p className="truncate text-sm font-medium text-foreground">{v}</p>
                      </div>
                    ))}
                  </div>
                  {/* Received progress across all lines */}
                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-muted-foreground">Received progress</span>
                      <span className="font-semibold text-foreground">{totalReceived} / {totalOrdered} units ({pct}%)</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                      <div className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Line items */}
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Rate ₹</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {data.status === 'approved' || data.status === 'partially_delivered' ? (
                      <TableHead className="w-[280px] text-right">Receive Now</TableHead>
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
                    const subText = isDrug
                      ? [it.drug?.genericName, it.drug?.manufacturer].filter(Boolean).join(' · ')
                      : it.inventoryItem?.itemCode ?? '';
                    const receiving = data.status === 'approved' || data.status === 'partially_delivered';
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="align-top font-medium">
                          <div className="flex items-center gap-1.5">
                            <span>{name}</span>
                            <Badge
                              variant="outline"
                              className={cn('text-[10px]', isDrug && 'bg-teal-500/10 text-teal-700 border-teal-500/20')}
                            >
                              {isDrug ? 'Drug' : 'Item'}
                            </Badge>
                          </div>
                          {subText && <p className="text-xs font-normal text-muted-foreground">{subText}</p>}
                        </TableCell>
                        <TableCell className="text-right align-top tabular-nums text-muted-foreground">
                          {it.unitPrice ? inr(it.unitPrice) : '—'}
                        </TableCell>
                        <TableCell className="text-right align-top tabular-nums">{it.quantityOrdered}</TableCell>
                        <TableCell className="text-right align-top tabular-nums">{it.quantityReceived}</TableCell>
                        <TableCell className="text-right align-top tabular-nums">
                          {pending > 0
                            ? <span className="font-medium text-amber-600">{pending}</span>
                            : <span className="text-emerald-600">0</span>}
                        </TableCell>
                        <TableCell className="text-right align-top tabular-nums font-medium">
                          {it.totalPrice
                            ? inr(it.totalPrice)
                            : it.unitPrice
                              ? inr(it.quantityOrdered * Number(it.unitPrice))
                              : '—'}
                        </TableCell>
                        {receiving && (
                          <TableCell className="align-top text-right">
                            <div className="ml-auto flex w-full max-w-[260px] flex-col gap-1.5">
                              <Input
                                type="number"
                                min={0}
                                max={pending}
                                value={recvMap[it.id] ?? ''}
                                placeholder={`Receive (max ${pending})`}
                                onChange={(e) => {
                                  const v = Math.max(0, Math.min(pending, Number(e.target.value) || 0));
                                  setRecvMap({ ...recvMap, [it.id]: v });
                                }}
                                className="h-9 w-full"
                                disabled={pending <= 0}
                              />
                              {/* Price is captured at arrival; drug lines also need batch + expiry. */}
                              {(recvMap[it.id] ?? 0) > 0 && (
                                <>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={recvPrice[it.id] ?? ''}
                                    onChange={(e) => {
                                      const v = e.target.value ? Math.max(0, Number(e.target.value)) : 0;
                                      setRecvPrice({ ...recvPrice, [it.id]: v });
                                    }}
                                    placeholder="Unit ₹ (purchase)"
                                    title="Purchase price per unit"
                                    className="h-8 w-full text-xs"
                                  />
                                  {isDrug && (
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <Input
                                        value={recvBatch[it.id]?.batchNumber ?? ''}
                                        onChange={(e) => setBatch(it.id, { batchNumber: e.target.value })}
                                        placeholder="Batch no. *"
                                        className="h-8 text-xs"
                                      />
                                      <Input
                                        type="date"
                                        value={recvBatch[it.id]?.expiryDate ?? ''}
                                        onChange={(e) => setBatch(it.id, { expiryDate: e.target.value })}
                                        title="Expiry *"
                                        className="h-8 text-xs"
                                      />
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {data.notes && (
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <b>Notes:</b> {data.notes}
              </div>
            )}
          </div>
        )}
        <DialogFooter className="border-t bg-muted/30 px-6 py-4">
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
