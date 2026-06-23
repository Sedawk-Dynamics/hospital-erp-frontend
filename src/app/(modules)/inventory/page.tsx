'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, PillBottle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StockRegisterPanel } from '@/components/inventory/stock-register-panel';
import { DrugBatchesPanel } from '@/components/inventory/drug-batches-panel';
import { InventoryStockOverview } from '@/components/inventory/inventory-stock-overview';

// Two inventory views merged onto one route:
//  • "Stock Register" — the generic items master + stock-in log (InventoryItem).
//  • "Drug Batches"   — the full pharmacy batch workspace (DrugBatch).
// The old /inventory/batches route still works; it redirects to ?tab=batches.
type InvTab = 'register' | 'batches';

const tabFromParam = (value: string | null): InvTab =>
  value === 'batches' ? 'batches' : 'register';

export default function InventoryStockPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // The active tab is derived straight from the URL, so deep links
  // (/inventory?tab=batches) and the /inventory/batches redirect just work, and
  // browser back/forward stays in sync with no local state to reconcile.
  const tab = tabFromParam(searchParams.get('tab'));

  const changeTab = (next: InvTab) => {
    // Reflect the tab in the URL (replace, not push, so switching tabs doesn't
    // spam the history stack) and skip the scroll-to-top jump.
    router.replace(next === 'batches' ? '/inventory?tab=batches' : '/inventory', {
      scroll: false,
    });
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Unified summary across BOTH stock systems — leads the combined page. */}
      <InventoryStockOverview />

      <Tabs value={tab} onValueChange={(value) => changeTab(value as InvTab)}>
        <TabsList>
          <TabsTrigger value="register">
            <ClipboardList className="h-4 w-4" /> Stock Register
          </TabsTrigger>
          <TabsTrigger value="batches">
            <PillBottle className="h-4 w-4" /> Drug Batches
          </TabsTrigger>
        </TabsList>

        <TabsContent value="register" className="mt-4">
          {tab === 'register' && <StockRegisterPanel />}
        </TabsContent>
        <TabsContent value="batches" className="mt-4">
          {tab === 'batches' && <DrugBatchesPanel />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
