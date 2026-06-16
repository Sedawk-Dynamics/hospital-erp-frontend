'use client';

import { Pill, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { useFormularyAlternatives, type FormularyItem } from '@/hooks/use-pharmacy';

/**
 * G8: shows other brands carrying the same composition as `drug`, in-stock
 * first — so the counter can offer a substitute when the requested brand is
 * out of stock.
 */
export function AlternativesDialog({
  drug,
  onOpenChange,
  onPick,
}: {
  drug: Pick<FormularyItem, 'id' | 'drugName' | 'genericName'> | null;
  onOpenChange: (open: boolean) => void;
  onPick?: (id: string) => void;
}) {
  const { data, isLoading } = useFormularyAlternatives(drug?.id ?? null);
  const alternatives = data?.alternatives ?? [];

  return (
    <Dialog open={!!drug} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Alternative brands</DialogTitle>
          <DialogDescription>
            Same composition as <span className="font-medium text-foreground">{drug?.drugName}</span>
            {data?.composition ? <> — {data.composition}</> : null}.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Finding alternatives…
          </div>
        ) : alternatives.length === 0 ? (
          <EmptyState
            icon={Pill}
            title="No alternatives"
            description={
              drug?.genericName
                ? 'No other brand with this composition is in your formulary.'
                : 'This drug has no composition recorded, so alternatives can’t be matched.'
            }
          />
        ) : (
          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {alternatives.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onPick?.(a.id)}
                disabled={!onPick}
                className="flex w-full items-center justify-between gap-3 rounded-lg border bg-surface-container-lowest p-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-default"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{a.drugName}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[a.strength, a.dosageForm, a.manufacturer].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {a.price != null && (
                    <span className="font-mono text-xs text-muted-foreground">
                      ₹{Number(a.price).toFixed(2)}
                    </span>
                  )}
                  {a.inStock ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      Stock: {a.totalStock}
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Out</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
