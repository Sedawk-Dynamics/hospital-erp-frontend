'use client';

import { Repeat, Loader2, PackageX } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StockTypeBadge } from '@/components/shared/stock-type-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { cn } from '@/lib/utils';
import { useFormularyAlternatives, type FormularyAlternative } from '@/hooks/use-pharmacy';

/**
 * G8: surface alternative brands sharing a drug's composition right from the
 * counter search — so when the asked-for brand is out of stock the cashier can
 * offer an in-stock substitute (same salt) without leaving the bill. Each row
 * shows brand, composition, form, available stock and price; in-stock first.
 */
export function DrugSubstitutesDialog({
  drug,
  onAdd,
  onOpenChange,
}: {
  drug: { id: string; drugName: string; genericName: string | null } | null;
  onAdd: (alt: FormularyAlternative) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useFormularyAlternatives(drug?.id ?? null);
  const alternatives = data?.alternatives ?? [];
  const composition = data?.composition ?? drug?.genericName ?? null;

  return (
    <Dialog open={!!drug} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-primary" />
            Alternatives for {drug?.drugName}
          </DialogTitle>
          <DialogDescription>
            {composition ? (
              <>
                Brands carrying the same composition —{' '}
                <span className="font-medium text-foreground">{composition}</span>. In-stock first.
              </>
            ) : (
              'Other brands sharing this composition.'
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Finding alternatives…
          </div>
        ) : alternatives.length === 0 ? (
          <EmptyState
            icon={PackageX}
            title="No alternatives"
            description="No other brand shares this composition in the formulary."
          />
        ) : (
          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {alternatives.map((alt) => (
              <div
                key={alt.id}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border p-3',
                  alt.inStock ? 'bg-surface-container-lowest' : 'opacity-70',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{alt.drugName}</span>
                    <StockTypeBadge category={alt.category} />
                    {alt.dosageForm && (
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {alt.dosageForm}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {[alt.genericName, alt.strength, alt.manufacturer].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <p className="mt-0.5 text-[11px]">
                    {alt.inStock ? (
                      <span className="text-emerald-600">In stock: {alt.totalStock}</span>
                    ) : (
                      <span className="text-amber-600">Out of stock</span>
                    )}
                    {alt.price != null && (
                      <span className="text-muted-foreground"> · ₹{Number(alt.price).toFixed(2)}</span>
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={alt.inStock ? 'default' : 'outline'}
                  disabled={!alt.inStock}
                  onClick={() => onAdd(alt)}
                >
                  Add
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
