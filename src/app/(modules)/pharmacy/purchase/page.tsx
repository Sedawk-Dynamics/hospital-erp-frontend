'use client';

import Link from 'next/link';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';

// Pharmacy purchase orders are managed in the unified Inventory module
// (single PO surface across drugs, consumables, equipment). This page
// guides the user there instead of duplicating the UI.
export default function PharmacyPurchaseRedirectPage() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="font-headline text-xl font-bold flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" /> Purchase Orders
        </h1>
        <p className="text-xs text-muted-foreground">
          Pharmacy POs are now part of the unified inventory workflow.
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        <EmptyState
          icon={ShoppingCart}
          title="Moved to Inventory module"
          description="Purchase orders for pharmacy stock are managed alongside other items in the Inventory module."
          action={
            <Link href="/inventory/purchase-orders">
              <Button>
                Open Purchase Orders <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          }
        />
      </div>
    </div>
  );
}
