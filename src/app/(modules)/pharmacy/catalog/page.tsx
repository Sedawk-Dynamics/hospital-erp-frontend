'use client';
import { PharmacyAdminGuard } from '@/components/pharmacy/pharmacy-admin-guard';

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  PackagePlus,
  CheckSquare,
  Square,
  Check,
  Loader2,
  Database,
} from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import {
  usePharmacyCatalog,
  useImportFormularyItem,
  useImportFormularyBulk,
  type CatalogItem,
  type DosageForm,
} from '@/hooks/use-pharmacy';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';

const DOSAGE_FORMS: DosageForm[] = [
  'tablet',
  'capsule',
  'syrup',
  'injection',
  'cream',
  'drops',
  'inhaler',
  'other',
];

type ImportedFilter = 'all' | 'no' | 'yes';

function PharmacyCatalogPageInner() {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [importedFilter, setImportedFilter] = useState<ImportedFilter>('all');
  const [dosageForm, setDosageForm] = useState<string>('any');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(input.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const { data, isLoading } = usePharmacyCatalog({
    page,
    limit: 20,
    search: search || undefined,
    imported: importedFilter === 'all' ? undefined : importedFilter,
    dosageForm: (dosageForm === 'any' ? undefined : dosageForm) as DosageForm | undefined,
  });

  const items = data?.data ?? [];
  const meta = data?.meta;

  const importItem = useImportFormularyItem();
  const importBulk = useImportFormularyBulk();

  // Selectable = not-yet-imported rows on the current page.
  const selectableIds = useMemo(
    () => items.filter((d) => !d.imported).map((d) => d.id),
    [items],
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const selectedCount = selected.size;

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
      const everySelected = selectableIds.every((id) => next.has(id));
      if (everySelected) selectableIds.forEach((id) => next.delete(id));
      else selectableIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function handleImportOne(id: string) {
    setImportingId(id);
    try {
      await importItem.mutateAsync({ drugMasterId: id });
      toast.success('Drug copied to formulary');
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to copy';
      toast.error(msg);
    } finally {
      setImportingId(null);
    }
  }

  async function handleImportBulk() {
    if (selectedCount === 0) return;
    try {
      const res = await importBulk.mutateAsync({ drugMasterIds: [...selected] });
      toast.success(
        `Copied ${res.created} drug${res.created !== 1 ? 's' : ''} to formulary` +
          (res.skipped ? ` · ${res.skipped} already there` : ''),
      );
      setSelected(new Set());
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to copy';
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Drug Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Browse the platform-wide drug catalog and copy drugs into your hospital formulary. Then
            set prices and add stock under Drug Formulary.
          </p>
        </div>
        {selectedCount > 0 && (
          <Button onClick={handleImportBulk} disabled={importBulk.isPending}>
            {importBulk.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <PackagePlus className="mr-1.5 h-4 w-4" />
            )}
            Add {selectedCount} to formulary
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search catalog by brand or composition..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {([
            { key: 'all', label: 'All' },
            { key: 'no', label: 'Not in formulary' },
            { key: 'yes', label: 'In formulary' },
          ] as const).map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={importedFilter === f.key ? 'default' : 'outline'}
              onClick={() => {
                setImportedFilter(f.key);
                setPage(1);
              }}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <Select
          value={dosageForm}
          onValueChange={(v) => {
            setDosageForm(v ?? 'any');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Any form" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any form</SelectItem>
            {DOSAGE_FORMS.map((f) => (
              <SelectItem key={f} value={f} className="capitalize">
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-muted/60" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Database}
            title="No drugs found"
            description={
              search || dosageForm || importedFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'The catalog is empty.'
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[44px]">
                    {selectableIds.length > 0 && (
                      <button type="button" onClick={toggleAllVisible} aria-label="Select all">
                        {allSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    )}
                  </TableHead>
                  <TableHead>Drug Name</TableHead>
                  <TableHead>Composition</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Form</TableHead>
                  <TableHead>Pack</TableHead>
                  <TableHead className="text-right">MRP</TableHead>
                  <TableHead className="text-right w-[120px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((d: CatalogItem) => {
                  const checked = selected.has(d.id);
                  return (
                    <TableRow key={d.id} className={d.imported ? 'opacity-70' : undefined}>
                      <TableCell>
                        {!d.imported && (
                          <button
                            type="button"
                            onClick={() => toggleOne(d.id)}
                            aria-label={checked ? 'Unselect' : 'Select'}
                          >
                            {checked ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {d.name}
                        {d.strength ? <span className="text-muted-foreground"> {d.strength}</span> : null}
                        {d.schedule && (
                          <Badge className="ml-2 bg-amber-500/10 text-amber-600 border-amber-500/20">
                            Sch {d.schedule}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{d.genericName || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{d.manufacturer || '-'}</TableCell>
                      <TableCell className="capitalize">{d.dosageForm || '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{d.packSizeLabel || '-'}</TableCell>
                      <TableCell className="text-right font-mono">
                        {d.mrp != null ? `₹${Number(d.mrp).toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {d.imported ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            <Check className="mr-1 h-3 w-3" />
                            In formulary
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={importingId === d.id}
                            onClick={() => handleImportOne(d.id)}
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
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, meta.total)} of{' '}
                  {meta.total.toLocaleString('en-IN')}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">
                    {page} / {meta.totalPages.toLocaleString('en-IN')}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
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

export default function PharmacyCatalogPage() {
  return (
    <PharmacyAdminGuard>
      <PharmacyCatalogPageInner />
    </PharmacyAdminGuard>
  );
}
