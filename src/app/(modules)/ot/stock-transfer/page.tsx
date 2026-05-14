'use client';

import { StockTransferBoard } from '@/components/shared/stock-transfer-board';

// The OT module is a consumer of stock. Most OT-initiated transfers will be
// either: (a) requesting stock IN to OT from the central pharmacy/warehouse,
// or (b) returning unused stock OUT to pharmacy. We don't force a default
// dept here — the user picks based on direction.
export default function OTStockTransferPage() {
  return (
    <StockTransferBoard
      title="OT Stock Transfer"
      description="Request stock from pharmacy / warehouse into OT, or return unused stock back"
    />
  );
}
