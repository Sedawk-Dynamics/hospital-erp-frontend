import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// The formulary holds every kind of stock now — medicines, consumables, surgical
// supplies, equipment — and they all move through the same flows (search,
// prescribing, dispensing, billing, expiry). So anywhere a product is listed,
// what it IS has to be visible; a consumable that looks exactly like a medicine
// in a picker is how the wrong thing ends up on a bill.
//
// Medicines are the overwhelming majority and the default assumption, so they
// render nothing by default — the badge marks the exception. Pass
// `showMedicine` where the list is genuinely mixed and silence would be
// ambiguous (a Type column, for instance).

export type StockCategory =
  | 'drug'
  | 'product'
  | 'consumable'
  | 'surgical_supply'
  | 'equipment'
  | 'other';

const LABELS: Record<StockCategory, string> = {
  drug: 'Medicine',
  product: 'Product',
  consumable: 'Consumable',
  surgical_supply: 'Surgical',
  equipment: 'Equipment',
  other: 'Other',
};

export function stockTypeLabel(category?: string | null): string {
  if (!category) return LABELS.drug;
  return LABELS[category as StockCategory] ?? category.replace(/_/g, ' ');
}

export function isMedicine(category?: string | null): boolean {
  // Rows created before the formulary held non-medicines have no category —
  // they were all medicines, so an absent category means medicine.
  return !category || category === 'drug';
}

export function StockTypeBadge({
  category,
  showMedicine = false,
  className,
}: {
  category?: string | null;
  showMedicine?: boolean;
  className?: string;
}) {
  if (isMedicine(category) && !showMedicine) return null;

  const medicine = isMedicine(category);
  return (
    <Badge
      variant="outline"
      className={cn(
        'shrink-0 text-[10px] font-medium',
        medicine
          ? 'border-primary/20 bg-primary/10 text-primary'
          : category === 'product'
            ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
        className,
      )}
    >
      {stockTypeLabel(category)}
    </Badge>
  );
}
