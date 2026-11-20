/**
 * Purchase-order line labels (gap 302).
 *
 * The Reorder History table shows one compact cell per PO: the first line with
 * its quantity and "and N more" for the rest, e.g. "Paracetamol 500 mg × 20
 * and 1 more". The full list stays available (tooltip/expand, and the CSV has
 * one row per line).
 */

export interface PoLineLike {
  itemName?: string | null;
  quantityOrdered?: number | string | null;
  inventoryItem?: { itemName?: string | null; itemCode?: string | null } | null;
  drug?: { drugName?: string | null } | null;
}

/** Never print "undefined" — item name, drug name, then code. */
export function poLineName(it: PoLineLike): string {
  return (
    it.itemName ||
    it.inventoryItem?.itemName ||
    it.drug?.drugName ||
    it.inventoryItem?.itemCode ||
    'Unnamed item'
  );
}

export function poLineLabel(it: PoLineLike): string {
  const qty = it.quantityOrdered;
  return qty === null || qty === undefined || qty === '' ? poLineName(it) : `${poLineName(it)} × ${qty}`;
}

/** "First × qty and N more" — or just the first line when there is one. */
export function poItemsSummary(items: PoLineLike[] | null | undefined, countFallback = 0): string {
  const list = items ?? [];
  if (list.length === 0) {
    return countFallback > 0 ? `${countFallback} item${countFallback === 1 ? '' : 's'}` : '—';
  }
  const first = poLineLabel(list[0]);
  const rest = list.length - 1;
  return rest > 0 ? `${first} and ${rest} more` : first;
}
