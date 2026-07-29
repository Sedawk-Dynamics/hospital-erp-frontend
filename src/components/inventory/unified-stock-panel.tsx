'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, Pill, Edit2, PackagePlus, ChevronDown, ChevronRight,
  ChevronLeft, AlertTriangle, MoreHorizontal, MoreVertical, ClipboardCheck, ClipboardList,
  Warehouse, Pencil, Trash2, Replace, Merge, Lightbulb,
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
  type UnifiedStockRow, type InventoryItem, type InventoryCategory,
} from '@/hooks/use-inventory';
import {
  useRunPharmacyExpiryAlerts, useFormularyItem, useDeleteFormularyItem,
  useSuggestDrugMaster, type FormularyItem, type FormularyMatch,
} from '@/hooks/use-pharmacy';
import { getApiErrorMessage } from '@/lib/utils';
import { InventoryStockOverview } from './inventory-stock-overview';
import { DrugBatchesPanel } from './drug-batches-panel';
import { ItemDialog, StockInDialog } from './stock-register-panel';
import { StockTakeDialog } from '@/components/pharmacy/stock-take-dialog';
import { StockTypeBadge, stockTypeLabel } from '@/components/shared/stock-type-badge';
import { StockAdjustmentsLogDialog } from '@/components/pharmacy/stock-adjust-dialogs';
import { DrugFormDialog } from '@/components/pharmacy/drug-form-dialog';
import { MergeDrugDialog } from '@/components/pharmacy/merge-drug-dialog';
import { AlternativesDialog } from '@/components/pharmacy/alternatives-dialog';
import { ImportFromCatalogDialog } from '@/components/pharmacy/import-from-catalog-dialog';

// A row's Type is its CATEGORY, not which table it lives in. Every kind of stock
// (medicine, consumable, surgical, equipment) is now stocked the same way — as a
// formulary row with batches — so `kind` is 'drug' for almost everything and says
// nothing about what the thing actually is. Only `category` does.
type TypeFilter = 'all' | InventoryCategory;
type StatusFilter = 'all' | 'in' | 'low' | 'out' | 'expiring' | 'recalled';

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'drug', label: 'Medicines' },
  { value: 'consumable', label: 'Consumables' },
  { value: 'surgical_supply', label: 'Surgical' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
];

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

  // Drug (formulary) operations — the old /inventory/drug-formulary page is gone,
  // so all of its drug actions live here on the unified Storage rows.
  const [newDrugOpen, setNewDrugOpen] = useState(false);
  const [editDrugId, setEditDrugId] = useState<string | null>(null);
  const [mergeDrug, setMergeDrug] = useState<{ id: string; name: string } | null>(null);
  const [altDrug, setAltDrug] = useState<{ id: string; name: string } | null>(null);

  const router = useRouter();
  const runExpiry = useRunPharmacyExpiryAlerts();
  const deleteDrug = useDeleteFormularyItem();
  const suggestMaster = useSuggestDrugMaster();

  const handleDeleteDrug = async (id: string, name: string) => {
    if (!window.confirm(`Remove "${name}" from the formulary? This can't be undone.`)) return;
    try {
      await deleteDrug.mutateAsync(id);
      toast.success('Drug removed');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to remove drug'));
    }
  };

  const handleSuggestToMaster = async (row: UnifiedStockRow) => {
    if (!window.confirm(`Suggest "${row.name}" for the national drug master? A platform admin will review it.`)) return;
    try {
      await suggestMaster.mutateAsync({ name: row.name });
      toast.success('Suggestion sent to the national master for review');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to send suggestion'));
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useUnifiedStock({
    page,
    limit: 20,
    search: debounced || undefined,
    category: type === 'all' ? undefined : type,
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
          {/* Catalog import + a blank New Drug form (moved here from the retired
              Drug Formulary page). Bulk stock inward still lives on /inventory/add. */}
          <ImportFromCatalogDialog />
          <Button size="sm" variant="outline" onClick={() => setNewDrugOpen(true)}>
            <Pill className="mr-1.5 h-4 w-4" /> New Drug
          </Button>
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
            {TYPE_FILTERS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
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
                    onEditDrug={() => setEditDrugId(row.refId)}
                    onMerge={() => setMergeDrug({ id: row.refId, name: row.name })}
                    onAlternatives={() => setAltDrug({ id: row.refId, name: row.name })}
                    onSuggest={() => handleSuggestToMaster(row)}
                    onDeleteDrug={() => handleDeleteDrug(row.refId, row.name)}
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

      {/* ── Drug (formulary) dialogs ── */}
      {/* New blank drug */}
      <DrugFormDialog
        open={newDrugOpen}
        onOpenChange={setNewDrugOpen}
        onUseExisting={(m) => setExpandedId(`drug-${m.id}`)}
      />
      {/* Edit an existing drug — loads the full record first. */}
      {editDrugId && (
        <DrugEditLoader
          id={editDrugId}
          onClose={() => setEditDrugId(null)}
          onUseExisting={(m) => setExpandedId(`drug-${m.id}`)}
        />
      )}
      {/* Merge / Alternatives only need the drug's id + name. */}
      <MergeDrugDialog
        source={mergeDrug ? ({ id: mergeDrug.id, drugName: mergeDrug.name } as FormularyItem) : null}
        onOpenChange={(o) => !o && setMergeDrug(null)}
      />
      <AlternativesDialog
        drug={altDrug ? ({ id: altDrug.id, drugName: altDrug.name } as FormularyItem) : null}
        onOpenChange={(o) => !o && setAltDrug(null)}
      />
    </div>
  );
}

// Edit a drug — the unified row carries only a subset, so load the full
// formulary record before opening the shared drug form.
function DrugEditLoader({
  id, onClose, onUseExisting,
}: {
  id: string;
  onClose: () => void;
  onUseExisting?: (m: FormularyMatch) => void;
}) {
  const { data: drug, isLoading } = useFormularyItem(id);
  if (isLoading || !drug) return null;
  return (
    <DrugFormDialog
      open
      drug={drug}
      onOpenChange={(o) => !o && onClose()}
      onSaved={onClose}
      onUseExisting={onUseExisting}
    />
  );
}

// One row of the unified list. Drugs expand inline to the full batch workspace;
// generic items expose Stock In + Edit.
function StockRow({
  row, expanded, onToggle, onStockIn, onEdit,
  onEditDrug, onMerge, onAlternatives, onSuggest, onDeleteDrug,
}: {
  row: UnifiedStockRow;
  expanded: boolean;
  onToggle: () => void;
  onStockIn: () => void;
  onEdit: () => void;
  onEditDrug: () => void;
  onMerge: () => void;
  onAlternatives: () => void;
  onSuggest: () => void;
  onDeleteDrug: () => void;
}) {
  // `kind` only says which table the row came from — since every type is stocked
  // as a formulary row now, it is 'drug' for consumables and equipment too. What
  // the row IS comes from `category`; whether it expands to batches from `kind`.
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
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{row.name}</span>
          </div>
          {row.composition && (
            <div className="text-xs text-muted-foreground italic">{row.composition}</div>
          )}
          <div className="text-xs text-muted-foreground">
            {[row.code, row.unit].filter(Boolean).join(' · ') || stockTypeLabel(row.category).toLowerCase()}
          </div>
          {row.mappingNames && (
            <div className="text-[11px] text-muted-foreground/80">
              also known as: {row.mappingNames}
            </div>
          )}
        </TableCell>
        <TableCell>
          {/* A dedicated Type column — show it for medicines too, since silence
              in a column reads as missing data rather than "it's a medicine". */}
          <StockTypeBadge category={row.category} showMedicine />
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
              <>
                <Button size="sm" variant="outline" className="h-8 px-2" onClick={onToggle} title="Receive & manage batches">
                  <PackagePlus className="mr-1 h-3.5 w-3.5" /> Batches
                </Button>
                {/* Every drug-master operation the old Formulary page had. */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="More" />}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onEditDrug}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit drug
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onAlternatives}>
                      <Replace className="mr-2 h-4 w-4" /> Alternatives
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onMerge}>
                      <Merge className="mr-2 h-4 w-4" /> Merge duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onSuggest}>
                      <Lightbulb className="mr-2 h-4 w-4" /> Suggest to catalog
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={onDeleteDrug}>
                      <Trash2 className="mr-2 h-4 w-4" /> Remove drug
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
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
