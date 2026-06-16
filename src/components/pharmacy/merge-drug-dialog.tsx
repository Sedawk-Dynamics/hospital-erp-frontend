'use client';

import { useState } from 'react';
import { Merge, Loader2 } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/empty-state';
import {
  useFormularyMatches,
  useMergeFormulary,
  type FormularyItem,
  type FormularyMatch,
} from '@/hooks/use-pharmacy';

/**
 * G1: consolidate stock that has already split across two near-duplicate drugs.
 * Opened from a formulary row; lists the other rows that look like the same drug
 * and merges the chosen target's batches + history with this one (the source is
 * removed). Stock searched for "Telma 40" then shows the combined total.
 */
export function MergeDrugDialog({
  source,
  onOpenChange,
}: {
  source: FormularyItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const merge = useMergeFormulary();

  const { data: matches = [], isLoading } = useFormularyMatches(
    {
      name: source?.drugName ?? '',
      genericName: source?.genericName ?? undefined,
      manufacturer: source?.manufacturer ?? undefined,
      strength: source?.strength ?? undefined,
      dosageForm: source?.dosageForm ?? undefined,
      excludeId: source?.id,
    },
    !!source,
  );

  const target = matches.find((m: FormularyMatch) => m.id === selected) ?? null;

  async function handleMerge() {
    if (!source || !target) return;
    try {
      await merge.mutateAsync({ targetId: target.id, sourceId: source.id });
      toast.success(`Merged "${source.drugName}" into "${target.drugName}"`);
      setSelected(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to merge drugs');
    }
  }

  return (
    <Dialog
      open={!!source}
      onOpenChange={(open) => {
        if (!open) setSelected(null);
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-4 w-4 text-primary" />
            Merge duplicate drug
          </DialogTitle>
          <DialogDescription>
            Move all batches, prescriptions and returns from{' '}
            <span className="font-medium text-foreground">{source?.drugName}</span> into a canonical
            drug. This consolidates split stock. <span className="font-medium text-foreground">
            {source?.drugName}</span> will then be removed.
          </DialogDescription>
        </DialogHeader>

        <div className="py-1">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Finding similar drugs…
            </div>
          ) : matches.length === 0 ? (
            <EmptyState
              icon={Merge}
              title="No similar drugs found"
              description="Nothing in the formulary looks like a duplicate of this drug."
            />
          ) : (
            <div className="space-y-2 max-h-[44vh] overflow-y-auto pr-1">
              {matches.map((m: FormularyMatch) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setSelected(m.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors',
                    selected === m.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'bg-surface-container-lowest hover:bg-muted/50',
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{m.drugName}</span>
                      <Badge variant="outline" className="shrink-0 font-mono text-[11px]">
                        {m.score}%
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {[m.strength, m.dosageForm, m.genericName, m.manufacturer]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    Stock: {m.totalStock}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleMerge} disabled={!target || merge.isPending}>
            {merge.isPending ? 'Merging…' : 'Merge into selected'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
