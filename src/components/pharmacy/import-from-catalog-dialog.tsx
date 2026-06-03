'use client';

// "Import from Catalog" — lets a hospital pharmacist search the platform-wide
// DrugMaster (~254K Indian drugs) and add one into their own formulary with a
// single click. The MRP becomes the default selling price (editable later).

import { useEffect, useState } from 'react';
import { Search, Loader2, Download, PackagePlus } from 'lucide-react';
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
} from '@/components/ui/dialog';
import { useDrugMasterSearch } from '@/hooks/use-drug-master';
import { useImportFormularyItem } from '@/hooks/use-pharmacy';

export function ImportFromCatalogDialog() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const { data: results = [], isFetching } = useDrugMasterSearch(query, open);
  const importItem = useImportFormularyItem();

  async function handleImport(drugMasterId: string) {
    setImportingId(drugMasterId);
    try {
      await importItem.mutateAsync({ drugMasterId });
      toast.success('Drug added to formulary');
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to import';
      toast.error(msg);
    } finally {
      setImportingId(null);
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
          <DialogTitle>Import from Drug Catalog</DialogTitle>
          <DialogDescription>
            Search the platform-wide Indian drug catalog and add a drug to your formulary. MRP is
            used as the default selling price — edit it afterwards if needed.
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

        <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1">
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
              No drugs found. You can still add it manually with &quot;Add Drug&quot;.
            </p>
          ) : (
            <ul className="divide-y">
              {results.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{d.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[d.genericName, d.manufacturer].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {d.mrp != null && (
                      <p className="text-xs font-medium">
                        ₹ {Number(d.mrp).toLocaleString('en-IN')}
                      </p>
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
