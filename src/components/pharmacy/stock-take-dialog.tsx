'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  ClipboardCheck,
  ChevronsUpDown,
  Check,
  Loader2,
  Boxes,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { DrugStockLabel } from '@/components/shared/drug-stock-label';
import {
  useBatches,
  useFormulary,
  useReconcileStockTake,
} from '@/hooks/use-pharmacy';

/**
 * G4: physical stock-take. Staff enter the physically counted quantity for each
 * batch on the shelf; the system flags every variance vs. its own count BEFORE
 * anything is written. On apply, each non-zero variance is posted as an audited
 * stock correction (who / from → to / reason / timestamp) and shows up in the
 * Stock adjustment log. Items left blank are not counted and are untouched.
 */
export function StockTakeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [drugFilter, setDrugFilter] = useState<string | null>(null);
  const [drugLabel, setDrugLabel] = useState('All drugs');
  const [drugComboOpen, setDrugComboOpen] = useState(false);
  const [drugSearch, setDrugSearch] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [reason, setReason] = useState('');
  // batchId → typed count / per-line note. Persist across filter changes.
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const reconcile = useReconcileStockTake();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: formularyResp } = useFormulary({ search: drugSearch || undefined, limit: 25, isActive: true });
  const drugs = formularyResp?.data ?? [];

  const { data: batchesResp, isLoading } = useBatches({
    drugId: drugFilter ?? undefined,
    search: debouncedSearch || undefined,
    availableOnly: true,
    limit: 200,
  });
  const batches = useMemo(() => batchesResp?.data ?? [], [batchesResp]);

  const reset = () => {
    setDrugFilter(null);
    setDrugLabel('All drugs');
    setDrugSearch('');
    setSearch('');
    setDebouncedSearch('');
    setReason('');
    setCounts({});
    setNotes({});
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const setCount = (id: string, v: string) => setCounts((p) => ({ ...p, [id]: v }));
  const setNote = (id: string, v: string) => setNotes((p) => ({ ...p, [id]: v }));

  // Live reconciliation summary over the currently-listed batches. The apply
  // payload submits every entered count regardless of the active filter; the
  // server is authoritative on the final matched/adjusted breakdown.
  const summary = useMemo(() => {
    let counted = 0, variances = 0, netDelta = 0, valueDelta = 0;
    for (const b of batches) {
      const raw = counts[b.id];
      if (raw === undefined || raw === '') continue;
      const n = parseInt(raw, 10);
      if (isNaN(n) || n < 0) continue;
      counted++;
      const delta = n - b.quantityInStock;
      if (delta !== 0) {
        variances++;
        netDelta += delta;
        valueDelta += delta * (Number(b.sellingPrice) || 0);
      }
    }
    return { counted, variances, netDelta, valueDelta };
  }, [counts, batches]);

  const handleApply = async () => {
    if (!reason.trim()) return toast.error('Enter a stock-take reason / reference');
    const lines: Array<{ batchId: string; countedQuantity: number; reason?: string }> = [];
    for (const [id, raw] of Object.entries(counts)) {
      if (raw === '' || raw == null) continue;
      const n = parseInt(raw, 10);
      if (isNaN(n) || n < 0) continue;
      lines.push({ batchId: id, countedQuantity: n, reason: notes[id]?.trim() || undefined });
    }
    if (!lines.length) return toast.error('Enter at least one physical count');
    if (summary.variances === 0 && summary.counted === lines.length) {
      return toast.info('All counted items match the system — no corrections needed.');
    }
    const ok = window.confirm(
      `Apply ${summary.variances} correction(s)?\n\n` +
        `Net change: ${summary.netDelta > 0 ? '+' : ''}${summary.netDelta} unit(s)` +
        `${summary.valueDelta ? ` (₹${summary.valueDelta.toFixed(2)})` : ''}.\n` +
        `${summary.counted - summary.variances} counted item(s) already match.`,
    );
    if (!ok) return;
    try {
      const res = await reconcile.mutateAsync({ reason: reason.trim(), lines });
      const msg = `Stock-take done — ${res.adjusted} corrected, ${res.matched} matched` +
        (res.failed ? `, ${res.failed} failed` : '');
      if (res.failed) toast.warning(msg);
      else toast.success(msg);
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reconcile stock-take');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Physical Stock Take
          </DialogTitle>
          <DialogDescription>
            Count the shelf and enter the physical quantity per batch. The system flags every
            variance — only counted batches with a difference are corrected, each logged with your
            name and reason.
          </DialogDescription>
        </DialogHeader>

        {/* Filters + reason */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Drug</Label>
            <Popover open={drugComboOpen} onOpenChange={setDrugComboOpen}>
              <PopoverTrigger render={
                <Button variant="outline" size="sm" className="w-full justify-between font-normal">
                  <span className="truncate">{drugLabel}</span>
                  <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50" />
                </Button>
              } />
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Search drug..." value={drugSearch} onValueChange={setDrugSearch} />
                  <CommandList>
                    <CommandEmpty>No drug found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem onSelect={() => { setDrugFilter(null); setDrugLabel('All drugs'); setDrugComboOpen(false); }}>
                        <Check className={cn('mr-2 h-4 w-4', drugFilter === null ? 'opacity-100' : 'opacity-0')} />
                        All drugs
                      </CommandItem>
                      {drugs.map((d) => (
                        <CommandItem
                          key={d.id}
                          value={d.id}
                          onSelect={() => { setDrugFilter(d.id); setDrugLabel(d.drugName); setDrugComboOpen(false); }}
                        >
                          <Check className={cn('mr-2 h-4 w-4', drugFilter === d.id ? 'opacity-100' : 'opacity-0')} />
                          <span className="truncate">{d.drugName}{d.strength ? ` ${d.strength}` : ''}</span>
                          <DrugStockLabel stock={d.totalStock} className="ml-auto shrink-0" />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Search batch / drug</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-9 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Batch number or name" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Stock-take reason / reference *</Label>
            <Input className="h-9" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Monthly count — Jun 2026" />
          </div>
        </div>

        {/* Count sheet */}
        <div className="flex-1 overflow-y-auto rounded-lg border">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : batches.length === 0 ? (
            <EmptyState icon={Boxes} title="No stock to count" description="No in-stock batches match this filter." />
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                  <th>Drug / Batch</th>
                  <th>Expiry</th>
                  <th className="text-right w-20">System</th>
                  <th className="w-28">Counted</th>
                  <th className="text-right w-20">Δ</th>
                  <th className="w-[160px]">Note</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const raw = counts[b.id] ?? '';
                  const n = raw === '' ? null : parseInt(raw, 10);
                  const delta = n == null || isNaN(n) ? null : n - b.quantityInStock;
                  return (
                    <tr key={b.id} className="border-t">
                      <td className="px-3 py-1.5">
                        <div className="font-medium">{b.drug?.drugName ?? '-'}</div>
                        <div className="text-xs text-muted-foreground font-mono">{b.batchNumber}</div>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(b.expiryDate)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{b.quantityInStock}</td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          className="h-8 text-sm"
                          value={raw}
                          onChange={(e) => setCount(b.id, e.target.value)}
                          placeholder="—"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {delta == null || delta === 0 ? (
                          <span className="text-muted-foreground">{delta === 0 ? '0' : '—'}</span>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn(
                              'font-mono',
                              delta > 0 ? 'text-emerald-700 border-emerald-500/30' : 'text-amber-700 border-amber-500/30',
                            )}
                          >
                            {delta > 0 ? '+' : ''}{delta}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          className="h-8 text-xs"
                          value={notes[b.id] ?? ''}
                          onChange={(e) => setNote(b.id, e.target.value)}
                          placeholder="optional"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="gap-2">
          <div className="mr-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Counted: <span className="font-medium text-foreground">{summary.counted}</span></span>
            <span>Variances: <span className={cn('font-medium', summary.variances ? 'text-amber-700' : 'text-foreground')}>{summary.variances}</span></span>
            {summary.variances > 0 && (
              <>
                <span>Net Δ: <span className="font-medium text-foreground">{summary.netDelta > 0 ? '+' : ''}{summary.netDelta}</span></span>
                <span>Value: <span className={cn('font-medium', summary.valueDelta < 0 ? 'text-amber-700' : 'text-emerald-700')}>₹{summary.valueDelta.toFixed(2)}</span></span>
              </>
            )}
          </div>
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button
            onClick={handleApply}
            disabled={reconcile.isPending || !Object.values(counts).some((v) => v !== '')}
          >
            {reconcile.isPending ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Applying…</>
            ) : (
              <><ClipboardCheck className="mr-1.5 h-4 w-4" /> Apply corrections</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
