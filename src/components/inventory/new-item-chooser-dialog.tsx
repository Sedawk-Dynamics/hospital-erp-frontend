'use client';

import { Package, Pill, Plus, Stethoscope, ShoppingBasket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function NewItemChooserDialog({
  open,
  onOpenChange,
  onDrug,
  onProduct,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDrug: () => void;
  onProduct: () => void;
}) {
  const choose = (next: () => void) => {
    onOpenChange(false);
    next();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="mr-1.5 h-4 w-4" /> New Item
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>What are you adding?</DialogTitle>
          <DialogDescription>
            Choose the correct item type. Both can be stocked and sold, but only drugs use
            composition, schedules, prescriptions and clinical safety rules.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => choose(onDrug)}
            className="group rounded-2xl border bg-surface-container-lowest p-4 text-left transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Pill className="h-5 w-5" />
            </span>
            <span className="flex items-center gap-2 font-semibold">
              New Drug <Stethoscope className="h-4 w-4 text-muted-foreground" />
            </span>
            <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
              A medicine with generic names, salt composition, dosage form, schedule and clinical details.
            </span>
          </button>

          <button
            type="button"
            onClick={() => choose(onProduct)}
            className="group rounded-2xl border bg-surface-container-lowest p-4 text-left transition hover:border-amber-500/40 hover:bg-amber-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30"
          >
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <Package className="h-5 w-5" />
            </span>
            <span className="flex items-center gap-2 font-semibold">
              New Product <ShoppingBasket className="h-4 w-4 text-muted-foreground" />
            </span>
            <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
              A non-drug retail item such as baby care, personal care, devices, nutrition or convenience goods.
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
