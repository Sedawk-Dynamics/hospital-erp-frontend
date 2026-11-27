import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDrugQty, type UnitSource } from '@/lib/pharmacy-units';

/**
 * Consistent "pharmacy availability" chip for a drug shown in ANY medicine
 * search / picker across the app. Renders one of:
 *   • "N in stock"     — a stocked formulary drug with quantity on hand (green)
 *   • "out of stock"   — a stocked formulary drug with nothing on hand (red)
 *   • "catalog · not stocked" — a platform-catalog drug the hospital hasn't
 *                        imported (so there's no stock to show) (muted)
 *
 * Pass whichever stock figure the search returns — `availableStock`
 * (prescriptions search) or `totalStock` (pharmacy formulary) — via `stock`.
 * Set `catalog` when the row is a catalog-only result (no tenant formulary id).
 * Pass `drug` where the row carries its pack/unit fields and the chip words the
 * stock as the bill does ("4 strips + 5 tablets (45 tablets)") — gap 345.
 */
export function DrugStockLabel({
  stock,
  drug,
  catalog = false,
  className,
}: {
  stock?: number | null;
  drug?: UnitSource | null;
  catalog?: boolean;
  className?: string;
}) {
  if (catalog) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'text-[9px] px-1.5 py-0 text-muted-foreground border-muted-foreground/30',
          className,
        )}
      >
        catalog · not stocked
      </Badge>
    );
  }
  const qty = stock ?? 0;
  if (qty > 0) {
    return (
      <span
        className={cn(
          'rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700',
          className,
        )}
      >
        {drug ? formatDrugQty(qty, drug) : qty} in stock
      </span>
    );
  }
  return (
    <span
      className={cn(
        'rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700',
        className,
      )}
    >
      out of stock
    </span>
  );
}
