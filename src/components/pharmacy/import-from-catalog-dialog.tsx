'use client';

// "Import from Catalog" — lets a hospital pharmacist search the platform-wide
// DrugMaster (~745K Indian medicines and OTC products) and copy them into their
// own inventory. Medicines remain drugs; OTC catalogue rows become retail
// products. Supports single-click add and multi-select bulk copy.

import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, Download, PackagePlus, CheckSquare, Square, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useDrugMasterSearch } from '@/hooks/use-drug-master';
import { useImportFormularyItem, useImportFormularyBulk } from '@/hooks/use-pharmacy';
import { DrugMonographPanel } from '@/components/pharmacy/drug-monograph-panel';

export function ImportFromCatalogDialog() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [importingId, setImportingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // One product's label facts and monograph, opened in place.
  const [detailsId, setDetailsId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  // Reset selection whenever the dialog closes.
  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setInput('');
      setDetailsId(null);
    }
  }, [open]);

  const { data: results = [], isFetching } = useDrugMasterSearch(query, open);
  const importItem = useImportFormularyItem();
  const importBulk = useImportFormularyBulk();

  const allSelected = results.length > 0 && results.every((d) => selected.has(d.id));
  const selectedCount = selected.size;

  const visibleIds = useMemo(() => results.map((d) => d.id), [results]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      const everyVisibleSelected = visibleIds.every((id) => next.has(id));
      if (everyVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function handleImport(drugMasterId: string) {
    setImportingId(drugMasterId);
    try {
      const item = await importItem.mutateAsync({ drugMasterId });
      toast.success(item.category === 'product' ? 'Product added to storage' : 'Drug added to formulary');
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to import';
      toast.error(msg);
    } finally {
      setImportingId(null);
    }
  }

  async function handleBulkImport() {
    if (selectedCount === 0) return;
    try {
      const res = await importBulk.mutateAsync({ drugMasterIds: [...selected] });
      toast.success(
        `Copied ${res.created} catalogue item${res.created !== 1 ? 's' : ''} to storage` +
          (res.skipped ? ` · ${res.skipped} already there` : ''),
      );
      setSelected(new Set());
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to import';
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Download className="mr-1.5 h-4 w-4" />
            Import from Catalog
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Copy from Product Catalog</DialogTitle>
          <DialogDescription>
            Search the platform-wide Indian catalogue. Medicine rows are added as drugs; OTC rows
            are added as non-drug retail products. Tick several to copy them in bulk. Catalogue MRP
            becomes the default unit price; review it before receiving stock.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder='Search brand or composition ("Augmentin", "Amoxycillin"…)'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="pl-8"
          />
        </div>

        {results.length > 0 && (
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={toggleAllVisible}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {allSelected ? 'Unselect all' : 'Select all results'}
            </button>
            {selectedCount > 0 && (
              <span className="text-muted-foreground">{selectedCount} selected</span>
            )}
          </div>
        )}

        <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1">
          {query.length < 2 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search the catalog.
            </p>
          ) : isFetching ? (
            <div className="py-10 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
            </div>
          ) : results.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No catalogue items found. You can still add one manually with &quot;New Item&quot;.
            </p>
          ) : (
            <ul className="divide-y">
              {results.map((d) => {
                const checked = selected.has(d.id);
                return (
                  <li key={d.id} className="py-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleOne(d.id)}
                        className="shrink-0 text-muted-foreground hover:text-primary"
                        aria-label={checked ? 'Unselect' : 'Select'}
                      >
                        {checked ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 text-sm">
                          <span className="truncate font-semibold">{d.name}</span>
                          {d.type === 'otc' && (
                            <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-800">
                              OTC
                            </span>
                          )}
                          {d.rxRequired && (
                            <span
                              className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-800"
                              title="The label says prescription required"
                            >
                              Rx
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[d.genericName, d.manufacturer].filter(Boolean).join(' · ') || '—'}
                        </p>
                        {d.type === 'otc' && d.productCategory && (
                          <p className="text-[10px] text-amber-700 dark:text-amber-300">
                            {d.productCategory}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setDetailsId((cur) => (cur === d.id ? null : d.id))}
                        className={`shrink-0 rounded p-1 hover:bg-surface-container-high ${
                          detailsId === d.id ? 'text-primary' : 'text-muted-foreground'
                        }`}
                        aria-label={detailsId === d.id ? 'Hide details' : 'Show details'}
                        aria-expanded={detailsId === d.id}
                      >
                        <Info className="h-4 w-4" />
                      </button>
                      <div className="text-right shrink-0">
                        {d.mrp != null && (
                          <p className="text-xs font-medium">₹ {Number(d.mrp).toLocaleString('en-IN')}</p>
                        )}
                        {d.packSizeLabel && (
                          <p className="text-[10px] text-muted-foreground">{d.packSizeLabel}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="shrink-0"
                        disabled={importingId === d.id}
                        onClick={() => handleImport(d.id)}
                      >
                        {importingId === d.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <PackagePlus className="mr-1 h-3.5 w-3.5" />
                            Add
                          </>
                        )}
                      </Button>
                    </div>
                    {detailsId === d.id && (
                      <div className="ml-7 mt-2 rounded-lg border bg-surface-container-low p-3">
                        <DrugMonographPanel drugId={d.id} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selectedCount > 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button onClick={handleBulkImport} disabled={importBulk.isPending}>
              {importBulk.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <PackagePlus className="mr-1.5 h-4 w-4" />
              )}
              Add {selectedCount} to formulary
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
