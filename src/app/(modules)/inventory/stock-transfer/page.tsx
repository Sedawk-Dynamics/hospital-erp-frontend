'use client';

import { StockTransferBoard } from '@/components/shared/stock-transfer-board';

export default function InventoryStockTransferPage() {
  return (
    <StockTransferBoard
      title="Stock Transfer"
      description="Move inventory between departments — pharmacy, OT, ward, lab, warehouse and more"
    />
  );
}
