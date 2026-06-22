'use client';

import { StockTransferBoard } from '@/components/shared/stock-transfer-board';

export default function InventoryStockTransferPage() {
  return (
    <StockTransferBoard
      title="Stock Transfer"
      description="Issue stock from the pharmacy store to a department, ward, or other location"
      fromPharmacyOnly
    />
  );
}
