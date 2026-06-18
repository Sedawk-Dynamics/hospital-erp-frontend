'use client';

import { useMemo, useState } from 'react';
import {
  ShoppingCart,
  Sparkles,
  Printer,
  Send,
  PackageCheck,
  X,
  Trash2,
  Loader2,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import {
  useDrugPurchaseOrders,
  useReorderList,
  useGeneratePurchaseOrders,
  useUpdateDrugPurchaseOrder,
  useSetDrugPurchaseOrderStatus,
  useDeleteDrugPurchaseOrder,
  type DrugPurchaseOrder,
} from '@/hooks/use-pharmacy';
import { useSuppliers } from '@/hooks/use-inventory';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  sent: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  received: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  cancelled: 'bg-muted text-muted-foreground',
};

const FILTERS: Array<{ label: string; value: string | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Received', value: 'received' },
  { label: 'Cancelled', value: 'cancelled' },
];

// Open a print-friendly window for a purchase order.
function printPurchaseOrder(po: DrugPurchaseOrder) {
  const rows = po.items
    .map(
      (i, n) =>
        `<tr><td>${n + 1}</td><td>${i.drug?.drugName ?? '-'}${i.drug?.strength ? ` ${i.drug.strength}` : ''}</td><td>${i.drug?.manufacturer ?? '-'}</td><td style="text-align:right">${i.quantityOrdered}</td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html><head><title>${po.orderNumber}</title>
    <style>body{font-family:system-ui,Arial,sans-serif;padding:24px;color:#111}
    h1{font-size:18px;margin:0 0 4px}.muted{color:#666;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5}</style></head>
    <body>
      <h1>Purchase Order — ${po.orderNumber}</h1>
      <p class="muted">Supplier: ${po.supplier?.name ?? 'Not assigned'}${po.supplier?.gstNumber ? ` · GSTIN ${po.supplier.gstNumber}` : ''}<br/>
      Date: ${formatDate(po.createdAt)} · Status: ${po.status}</p>
      <table><thead><tr><th>#</th><th>Medicine</th><th>Manufacturer</th><th style="text-align:right">Qty</th></tr></thead>
      <tbody>${rows}</tbody></table>
      ${po.notes ? `<p class="muted" style="margin-top:12px">${po.notes}</p>` : ''}
    </body></html>`;
  const w = window.open('', '_blank', 'width=800,height=600');
  if (!w) return toast.error('Allow pop-ups to print');
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

export default function DrugPurchaseOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const { data: orders = [], isLoading } = useDrugPurchaseOrders(statusFilter);
  const { data: reorder } = useReorderList();
  const { data: suppliersData } = useSuppliers({ limit: 100 });
  const suppliers = suppliersData?.data ?? [];

  const generate = useGeneratePurchaseOrders();
  const update = useUpdateDrugPurchaseOrder();
  const setStatus = useSetDrugPurchaseOrderStatus();
  const del = useDeleteDrugPurchaseOrder();

  const reorderCount = reorder?.items?.length ?? 0;

  const handleGenerate = async () => {
    try {
      const res = await generate.mutateAsync();
      if (res.created) {
        toast.success(
          `Generated ${res.created} draft PO(s)${res.skipped ? ` · ${res.skipped} drug(s) already on an open order` : ''}`,
        );
        setStatusFilter('draft');
      } else if (res.skipped) {
        toast.info('All low-stock drugs are already on an open purchase order.');
      } else {
        toast.info('No drugs are at or below their minimum stock.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate purchase orders');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Drug Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">
            Generate draft orders from drugs at or below their minimum stock, review, then mark sent.
            Nothing is dispatched automatically.
          </p>
        </div>
        <Button size="sm" onClick={handleGenerate} disabled={generate.isPending}>
          {generate.isPending ? (
            <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Generating…</>
          ) : (
            <><Sparkles className="mr-1.5 h-4 w-4" /> Generate from reorder</>
          )}
        </Button>
      </div>

      {reorderCount > 0 && (
        <div className="rounded-lg border bg-amber-500/5 px-4 py-2.5 text-sm text-amber-800">
          {reorderCount} drug(s) at or below minimum stock. Generate draft purchase orders to reorder.
        </div>
      )}

      {/* Status filter */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.label}
            size="sm"
            variant={statusFilter === f.value ? 'default' : 'outline'}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No purchase orders"
          description="Generate draft orders from your low-stock drugs to get started."
        />
      ) : (
        <div className="space-y-3">
          {orders.map((po) => (
            <PoCard
              key={po.id}
              po={po}
              suppliers={suppliers}
              saving={update.isPending}
              onSave={(payload) =>
                update
                  .mutateAsync(payload)
                  .then(() => toast.success('Order updated'))
                  .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to update'))
              }
              onSetStatus={(status) =>
                setStatus
                  .mutateAsync({ id: po.id, status })
                  .then(() => toast.success(`Order ${status}`))
                  .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'))
              }
              onDelete={() => {
                if (!confirm(`Delete draft order ${po.orderNumber}?`)) return;
                del
                  .mutateAsync(po.id)
                  .then(() => toast.success('Draft order deleted'))
                  .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'));
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PoCard({
  po,
  suppliers,
  saving,
  onSave,
  onSetStatus,
  onDelete,
}: {
  po: DrugPurchaseOrder;
  suppliers: Array<{ id: string; name: string }>;
  saving: boolean;
  onSave: (payload: { id: string; supplierId?: string | null; items?: Array<{ drugId: string; quantityOrdered: number }> }) => void;
  onSetStatus: (status: 'sent' | 'received' | 'cancelled') => void;
  onDelete: () => void;
}) {
  const isDraft = po.status === 'draft';
  const [supplierId, setSupplierId] = useState(po.supplierId ?? '');
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(po.items.map((i) => [i.id, String(i.quantityOrdered)])),
  );

  const dirty = useMemo(() => {
    if ((supplierId || null) !== (po.supplierId ?? null)) return true;
    return po.items.some((i) => String(i.quantityOrdered) !== (qty[i.id] ?? ''));
  }, [supplierId, qty, po]);

  const totalQty = po.items.reduce((s, i) => s + (parseInt(qty[i.id] ?? '', 10) || 0), 0);

  const save = () => {
    onSave({
      id: po.id,
      supplierId: supplierId || null,
      items: po.items.map((i) => ({
        drugId: i.drugId,
        quantityOrdered: Math.max(1, parseInt(qty[i.id] ?? '', 10) || i.quantityOrdered),
      })),
    });
  };

  return (
    <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium">{po.orderNumber}</span>
          <Badge variant="outline" className={cn('capitalize', STATUS_STYLES[po.status])}>
            {po.status}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatDate(po.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => printPurchaseOrder(po)}>
            <Printer className="mr-1 h-3.5 w-3.5" /> Print
          </Button>
          {isDraft && (
            <>
              {dirty && (
                <Button size="sm" variant="outline" onClick={save} disabled={saving}>
                  <Save className="mr-1 h-3.5 w-3.5" /> Save
                </Button>
              )}
              <Button size="sm" onClick={() => onSetStatus('sent')} title="Mark this order as sent to the supplier">
                <Send className="mr-1 h-3.5 w-3.5" /> Mark sent
              </Button>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {po.status === 'sent' && (
            <>
              <Button size="sm" onClick={() => onSetStatus('received')}>
                <PackageCheck className="mr-1 h-3.5 w-3.5" /> Received
              </Button>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => onSetStatus('cancelled')}>
                <X className="mr-1 h-3.5 w-3.5" /> Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Supplier */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Supplier:</span>
        {isDraft ? (
          <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? '')}>
            <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Assign a supplier" /></SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm font-medium">{po.supplier?.name ?? 'Not assigned'}</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {po.items.length} line(s) · {totalQty} unit(s)
        </span>
      </div>

      {/* Items */}
      <div className="mt-2 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Medicine</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead className="text-right w-32">Qty to order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {po.items.map((i) => (
              <TableRow key={i.id}>
                <TableCell>
                  <span className="font-medium">{i.drug?.drugName ?? '-'}</span>
                  {i.drug?.strength && <span className="text-xs text-muted-foreground"> {i.drug.strength}</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{i.drug?.manufacturer ?? '-'}</TableCell>
                <TableCell className="text-right">
                  {isDraft ? (
                    <Input
                      type="number"
                      min={1}
                      value={qty[i.id] ?? ''}
                      onChange={(e) => setQty((p) => ({ ...p, [i.id]: e.target.value }))}
                      className="h-8 w-24 ml-auto text-right"
                    />
                  ) : (
                    <span className="font-mono">{i.quantityOrdered}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
