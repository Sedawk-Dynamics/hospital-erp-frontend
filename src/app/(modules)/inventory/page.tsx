'use client';

import { UnifiedStockPanel } from '@/components/inventory/unified-stock-panel';

// Stock Register and Drug Batches are merged into ONE storage list: a row is any
// "thing in storage" — a medicine (batch-tracked) or any other supply. "New Item"
// creates either; medicines expand inline to the full batch workspace. The old
// /inventory/batches route still works and redirects here.
export default function InventoryStoragePage() {
  return <UnifiedStockPanel />;
}
