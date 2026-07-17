'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, Pill, Edit2, PackagePlus, ChevronDown, ChevronRight,
  ChevronLeft, AlertTriangle, MoreHorizontal, ClipboardCheck, ClipboardList,
  Warehouse,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import {
  useUnifiedStock, useInventoryItem,
  type UnifiedStockRow, type InventoryItem,
} from '@/hooks/use-inventory';
import { useRunPharmacyExpiryAlerts } from '@/hooks/use-pharmacy';
import { InventoryStockOverview } from './inventory-stock-overview';
import { DrugBatchesPanel } from './drug-batches-panel';
import { ItemDialog, StockInDialog } from './stock-register-panel';
import { StockTakeDialog } from '@/components/pharmacy/stock-take-dialog';
import { StockAdjustmentsLogDialog } from '@/components/pharmacy/stock-adjust-dialogs';

type TypeFilter = 'all' | 'drug' | 'item';
type StatusFilter = 'all' | 'in' | 'low' | 'out' | 'expiring' | 'recalled';

const daysUntil = (d: string) => Math.floor((new Date(d).getTime() - Date.now()) / 86_400_000);
const money = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The unified Storage workspace — Stock Register (generic items) and Drug Batches
// merged into ONE list. A row is a "thing in storage": a medicine (batch-tracked)
// or any other supply. "New Item" creates either; medicines expand inline to the
// full batch workspace. Drug stock keeps its engine (FEFO/expiry/dispensing/NDPS)
// underneath — here it's just rolled up next to everything else.
export function UnifiedStockPanel() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Dialog state (New Item + Bulk Stock Inward now live on /inventory/add).
  const [stockInItem, setStockInItem] = useState<InventoryItem | null>(null);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [stockTakeOpen, setStockTakeOpen] = useState(false);
  const [adjustLogOpen, setAdjustLogOpen] = useState(false);

  const router = useRouter();
  const runExpiry = useRunPharmacyExpiryAlerts();

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useUnifiedStock({
    page,
    limit: 20,
    search: debounced || undefined,
    type: type === 'all' ? undefined : type,
    stockStatus: status === 'all' ? undefined : status,
  });
  const rows = data?.data ?? [];
  const meta = data?.meta;

  const handleRunExpiry = async () => {
    try {
      const res = await runExpiry.mutateAsync();
      const flagged = res?.expiredFlagged ?? 0;
      const alerts = res?.expiryAlerts ?? 0;
      const parts = [
        flagged > 0 ? `${flagged} expired batch${flagged === 1 ? '' : 'es'} flagged` : null,
        alerts > 0 ? `${alerts} near-expiry alert${alerts === 1 ? '' : 's'} sent` : null,
      ].filter(Boolean);
      toast.success(parts.length ? parts.join(' · ') : 'No expired or near-expiry stock found');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run expiry check');
    }
  };

  const statusChips: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'in', label: 'In stock' },
    { value: 'low', label: 'Low stock' },
    { value: 'out', label: 'Out of stock' },
    { value: 'expiring', label: 'Expiring' },
    { value: 'recalled', label: 'Recalled' },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <Warehouse className="h-5 w-5" /> Storage
          </h1>
          <p className="text-xs text-muted-foreground">
            One store for everything — medicines and supplies together. Add anything, receive stock, and manage batches &amp; expiry in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStockTakeOpen(true)}>
                <ClipboardCheck className="mr-2 h-4 w-4" /> Stock Take
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAdjustLogOpen(true)}>
                <ClipboardList className="mr-2 h-4 w-4" /> Adjustments log
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRunExpiry} disabled={runExpiry.isPending}>
                <AlertTriangle className="mr-2 h-4 w-4" /> Run expiry check
              </DropdownMenuItem>
              {/* Recall is issued per batch — open a drug and recall the affected batch. */}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => router.push('/inventory/add')}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Stock
          </Button>
        </div>
      </div>

      {/* Combined summary across items + drugs */}
      <InventoryStockOverview />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search medicines & items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={type} onValueChange={(v) => { setType(v as TypeFilter); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="drug">Medicines</SelectItem>
            <SelectItem value="item">Other items</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1.5">
          {statusChips.map((c) => (
            <Button
              key={c.value}
              size="sm"
              variant={status === c.value ? 'default' : 'outline'}
              onClick={() => { setStatus(c.value); setPage(1); }}
            >
              {c.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="Nothing in storage yet"
            description={debounced || type !== 'all' || status !== 'all'
              ? 'Try clearing the filters.'
              : 'Add your first medicine or supply to start tracking stock.'}
            action={
              <Button size="sm" onClick={() => router.push('/inventory/add')}>
                <Plus className="mr-1.5 h-4 w-4" /> Add Stock
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[36px]" />
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Reorder</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <StockRow
                    key={`${row.kind}-${row.refId}`}
                    row={row}
                    expanded={expandedId === `${row.kind}-${row.refId}`}
                    onToggle={() =>
                      setExpandedId((cur) =>
                        cur === `${row.kind}-${row.refId}` ? null : `${row.kind}-${row.refId}`,
                      )
                    }
                    onStockIn={() =>
                      setStockInItem({
                        id: row.refId,
                        itemName: row.name,
                        currentStock: row.currentStock,
                      } as InventoryItem)
                    }
                    onEdit={() => setEditItemId(row.refId)}
                  />
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

      {/* Dialogs (New Item + Bulk Stock Inward moved to /inventory/add) */}
      <StockTakeDialog open={stockTakeOpen} onOpenChange={setStockTakeOpen} />
      <StockAdjustmentsLogDialog open={adjustLogOpen} onOpenChange={setAdjustLogOpen} />
      {stockInItem && (
        <StockInDialog initialItem={stockInItem} onClose={() => setStockInItem(null)} />
      )}
      {editItemId && (
        <ItemEditLoader id={editItemId} onClose={() => setEditItemId(null)} />
      )}
    </div>
  );
}

// One row of the unified list. Drugs expand inline to the full batch workspace;
// generic items expose Stock In + Edit.
function StockRow({
  row, expanded, onToggle, onStockIn, onEdit,
}: {
  row: UnifiedStockRow;
  expanded: boolean;
  onToggle: () => void;
  onStockIn: () => void;
  onEdit: () => void;
}) {
  const isDrug = row.kind === 'drug';
  const low = row.reorderLevel != null && row.currentStock > 0 && row.currentStock <= row.reorderLevel;
  const out = row.currentStock <= 0;
  const expDays = row.nearestExpiry ? daysUntil(row.nearestExpiry) : null;
  const expSoon = expDays != null && expDays <= 90;
  const value = row.sellingPrice != null ? row.sellingPrice * row.currentStock : null;

  return (
    <>
      <TableRow className={expanded ? 'bg-muted/30' : undefined}>
        <TableCell className="pr-0">
          {isDrug && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onToggle} title="Show batches">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
        </TableCell>
        <TableCell>
          <div className="font-medium">{row.name}</div>
          <div className="text-xs text-muted-foreground">
            {[row.code, row.unit].filter(Boolean).join(' · ') || (isDrug ? 'medicine' : row.category)}
          </div>
        </TableCell>
        <TableCell>
          {isDrug ? (
            <Badge className="bg-primary/10 text-primary border-primary/20">
              <Pill className="mr-1 h-3 w-3" /> Medicine
            </Badge>
          ) : (
            <Badge variant="outline" className="capitalize">{row.category.replace('_', ' ')}</Badge>
          )}
        </TableCell>
        <TableCell className="text-right">
          <span className={cn('font-medium', out ? 'text-red-700' : low ? 'text-amber-700' : '')}>
            {row.currentStock}
          </span>
          {isDrug && row.batchCount > 0 && (
            <span className="ml-1 text-[11px] text-muted-foreground">({row.batchCount} batch{row.batchCount === 1 ? '' : 'es'})</span>
          )}
        </TableCell>
        <TableCell className="text-right text-muted-foreground">{row.reorderLevel ?? '-'}</TableCell>
        <TableCell className={cn('text-xs', expDays != null && expDays < 0 ? 'text-red-600' : expSoon ? 'text-amber-600' : 'text-muted-foreground')}>
          {row.nearestExpiry ? (
            <>
              {formatDate(row.nearestExpiry)}
              {expDays != null && expDays >= 0 && <span className="ml-1">({expDays}d)</span>}
            </>
          ) : '-'}
        </TableCell>
        <TableCell className="text-right font-mono text-sm">
          {value != null ? money(value) : '-'}
        </TableCell>
        <TableCell className="text-center">
          {row.isRecalled ? (
            <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Recalled</Badge>
          ) : out ? (
            <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Out of stock</Badge>
          ) : low ? (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Low</Badge>
          ) : expSoon ? (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Expiring</Badge>
          ) : (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">In stock</Badge>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            {isDrug ? (
              <Button size="sm" variant="outline" className="h-8 px-2" onClick={onToggle} title="Receive & manage batches">
                <PackagePlus className="mr-1 h-3.5 w-3.5" /> Batches
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" className="h-8 px-2" onClick={onStockIn} title="Record stock in">
                  <PackagePlus className="mr-1 h-3.5 w-3.5" /> Stock In
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onEdit} title="Edit item">
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>

      {isDrug && expanded && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={9} className="p-0">
            <div className="border-t px-4 py-3">
              <DrugBatchesPanel embedded lockedDrugId={row.refId} lockedDrugLabel={row.name} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// Edit a generic item — loads the full record (the list row only carries a subset)
// before opening the shared ItemDialog.
function ItemEditLoader({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: item, isLoading } = useInventoryItem(id);
  if (isLoading || !item) return null;
  return <ItemDialog item={item} onClose={onClose} />;
}
