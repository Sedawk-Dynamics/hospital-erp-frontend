'use client';

import { AlertTriangle, Check, PackagePlus } from 'lucide-react';
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
import type { FormularyMatch } from '@/hooks/use-pharmacy';

interface IncomingDrug {
  drugName: string;
  genericName?: string;
  manufacturer?: string;
  strength?: string;
  dosageForm?: string;
}

/**
 * G1: shown when the user tries to add a drug that closely matches one already
 * in the formulary. Lays the incoming entry next to the suggested matches so
 * the user can map the inward stock onto the existing record (the fix for split
 * stock) instead of creating a duplicate — or explicitly create it anyway.
 */
export function DrugDuplicateResolver({
  open,
  onOpenChange,
  incoming,
  matches,
  onUseExisting,
  onCreateAnyway,
  creating,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incoming: IncomingDrug;
  matches: FormularyMatch[];
  onUseExisting: (match: FormularyMatch) => void;
  onCreateAnyway: () => void;
  creating?: boolean;
}) {
  function scoreColor(score: number) {
    if (score >= 85) return 'bg-red-500/10 text-red-600 border-red-500/20';
    if (score >= 70) return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    return 'bg-muted text-muted-foreground';
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Possible duplicate detected
          </DialogTitle>
          <DialogDescription>
            A similar drug is already in your formulary. Add stock to the existing entry to keep your
            count in one place, or create this as a new drug if it really is different.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          {/* Incoming */}
          <div className="rounded-lg border border-dashed p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              You are adding
            </p>
            <p className="mt-0.5 font-semibold">{incoming.drugName}</p>
            <p className="text-xs text-muted-foreground">
              {[incoming.strength, incoming.dosageForm, incoming.genericName, incoming.manufacturer]
                .filter(Boolean)
                .join(' · ') || 'No additional details'}
            </p>
          </div>

          {/* Matches */}
          <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
            {matches.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-surface-container-lowest p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{m.drugName}</span>
                    <Badge className={cn('shrink-0 font-mono text-[11px]', scoreColor(m.score))}>
                      {m.score}% match
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {[m.strength, m.dosageForm, m.genericName, m.manufacturer]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                  <p className="mt-0.5 text-[11px]">
                    {m.totalStock > 0 ? (
                      <span className="text-emerald-600">In stock: {m.totalStock}</span>
                    ) : (
                      <span className="text-amber-600">Out of stock</span>
                    )}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => onUseExisting(m)}>
                  <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
                  Use this
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={onCreateAnyway} disabled={creating}>
            <Check className="mr-1.5 h-4 w-4" />
            {creating ? 'Creating…' : 'Create new anyway'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
